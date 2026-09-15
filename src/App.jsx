import { useState, useEffect, useMemo } from 'react';
import { Button } from './components/ui/button';
import { AlertCircle, RefreshCw, Maximize2, Minimize2, Package, Workflow, CalendarCheck, ClipboardList, Download, CheckCircle2, CalendarClock, AlertTriangle } from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './components/ui/chart';
import { Sparkline } from './components/ui/sparkline';
import { useCountUp } from './lib/useCountUp';
import { fetchCountryItems, fetchSignUpItems } from './lib/mondayClient';
import { COUNTRY_BOARDS, isLiveItem } from './lib/boards';

// A punchier, more saturated palette specifically for the market-share pie
// chart, chosen for maximum perceptual distinction between adjacent slices
// (avoids similar-looking warm tones sitting next to each other).
const PIE_COLORS = ['#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF'];
function pieColorFor(index) {
  return PIE_COLORS[index % PIE_COLORS.length];
}

const COUNTRIES = COUNTRY_BOARDS.map((b) => b.country);

// Column order and full display names for the Subway Pipeline Forecast
// table specifically, matching the existing reference report's layout.
const FORECAST_COLUMN_ORDER = ['UK', 'IE', 'FI', 'NL', 'DE'];

// The 5 detail sections below the KPI cards \u2014 one is shown at a time,
// picked via the icon-radio tab bar. Icon/accent match each SectionCard.
const SECTION_TABS = [
  { key: 'forecast', label: 'Estate Overview', icon: Package, accent: 'hsl(var(--chart-1))' },
  { key: 'scheduled', label: 'Scheduled vs Actual', icon: CalendarCheck, accent: 'hsl(var(--chart-4))' },
  { key: 'active', label: 'Active Pipeline', icon: Workflow, accent: 'hsl(var(--chart-2))' },
  { key: 'bau', label: 'BAU Forecast', icon: ClipboardList, accent: 'hsl(var(--chart-5))' },
  { key: 'priority', label: 'Priority Sites', icon: AlertTriangle, accent: 'hsl(var(--destructive))' }
];
const COUNTRY_DISPLAY_NAME = { UK: 'UK', IE: 'Ireland', FI: 'Finland', NL: 'Netherlands', DE: 'Germany' };

function countryColor(country) {
  return PIE_COLORS[COUNTRIES.indexOf(country) % PIE_COLORS.length];
}

// Finland has no further scheduling activity, so it's excluded from the
// forward-looking Scheduled vs Actual table specifically \u2014 it still
// appears everywhere else (top-line cards, market share, totals) since
// its live stores are still real and still count.
const SCHEDULE_TABLE_COUNTRIES = COUNTRIES.filter((c) => c !== 'FI');

const FLAGS = { UK: '\u{1F1EC}\u{1F1E7}', IE: '\u{1F1EE}\u{1F1EA}', NL: '\u{1F1F3}\u{1F1F1}', DE: '\u{1F1E9}\u{1F1EA}', FI: '\u{1F1EB}\u{1F1EE}' };

const YEAR_TARGET_SITES = 500;
const YEAR_START = new Date(2026, 0, 1); // 1 Jan 2026
const YEAR_END = new Date(2026, 11, 31); // 31 Dec 2026

function yearMonth(dateText) {
  if (!dateText || dateText.length < 7) return null;
  return dateText.slice(0, 7); // "YYYY-MM"
}

// "Expect Remodel Month" is a status field with text values like
// "September 2026" or the abbreviated "Feb 2026" \u2014 not a real date, so
// it needs its own parser rather than reusing yearMonth(). Non-month
// values ("CANCELLED", "BAU D2.0", a bare year like "2027") return null
// and are simply excluded from any month's count.
const MONTH_NAME_TO_NUM = {
  jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
  apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
  aug: '08', august: '08', sep: '09', sept: '09', september: '09',
  oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12'
};
function parseExpectRemodelMonth(text) {
  const t = (text || '').trim().toLowerCase();
  const match = t.match(/^([a-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const [, monthPart, year] = match;
  const num = MONTH_NAME_TO_NUM[monthPart];
  if (!num) return null;
  return `${year}-${num}`;
}

function formatYearMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getWeekStart(dateText) {
  const d = new Date(dateText);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKey(dateText) {
  if (!dateText) return null;
  return getWeekStart(dateText).toISOString().slice(0, 10); // YYYY-MM-DD of week start
}

function formatWeekLabel(weekStartStr) {
  return new Date(weekStartStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function AnimatedNumber({ value }) {
  const display = useCountUp(value);
  return <>{display.toLocaleString()}</>;
}

function KPICard({ label, value, hero = false, onClick, active = false, type }) {
  const typeConfig = {
    live: { color: 'hsl(var(--status-complete))', Icon: CheckCircle2 },
    scheduled: { color: 'hsl(var(--status-scheduled))', Icon: CalendarClock }
  }[type];

  return (
    <div
      className={`border rounded-md p-4 bg-[hsl(var(--surface-1))] transition-colors ${
        onClick ? 'cursor-pointer hover:border-primary' : ''
      } ${active ? 'border-primary' : 'border-border'}`}
      style={typeConfig ? { borderTop: `3px solid ${typeConfig.color}` } : undefined}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        {typeConfig && <typeConfig.Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: typeConfig.color }} />}
        <span className="line-clamp-2">{label}</span>
      </div>
      <div className={`font-semibold tabular-nums ${hero ? 'text-4xl' : 'text-3xl'}`}>{value}</div>
    </div>
  );
}

// Flags get their own larger, dedicated treatment rather than a small
// inline icon, since these are the primary "at a glance" cards for SLT.
function CountryCard({ country, flag, value, trend }) {
  return (
    <div className="border border-border rounded-md p-4 bg-[hsl(var(--surface-1))] flex items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <div className="text-5xl leading-none">{flag}</div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">{country}</div>
          <div className="text-4xl font-semibold tabular-nums"><AnimatedNumber value={value} /></div>
        </div>
      </div>
      {trend && trend.length > 1 && <Sparkline data={trend} color="hsl(var(--primary))" />}
    </div>
  );
}

function PlaceholderCard({ label }) {
  return (
    <div className="border border-dashed border-border rounded-md p-4 bg-[hsl(var(--surface-1))]">
      <div className="text-xs text-muted-foreground mb-2 line-clamp-2">{label}</div>
      <div className="text-lg font-medium text-muted-foreground">Coming soon</div>
    </div>
  );
}

// Every major section below shares this shell: a colored top accent strip
// and a small icon badge, so the page can be scanned by section at a
// glance in a live presentation rather than reading a wall of identical
// grey cards.
function SectionCard({ icon: Icon, accent, title, footer, children, open = true }) {
  return (
    <div
      className="border border-border rounded-md bg-[hsl(var(--surface-1))] overflow-hidden section-card"
      style={{ borderTop: `3px solid ${accent}`, display: open ? 'block' : 'none' }}
    >
      <div className="px-5 py-3 border-b border-border flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}22` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
        <h3 className="text-sm font-semibold flex-1">{title}</h3>
      </div>
      <div className="section-body">
        {children}
        {footer && (
          <p className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border">{footer}</p>
        )}
      </div>
    </div>
  );
}

// One icon-radio button in the section tab bar \u2014 a real <input type="radio">
// under the hood for genuine radio semantics, styled as a card with the
// section's own icon standing in for an image.
function SectionTabRadio({ name, checked, onChange, icon: Icon, label, accent }) {
  return (
    <label
      className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-md border cursor-pointer transition-colors flex-1 min-w-[110px]"
      style={{
        borderColor: checked ? accent : 'hsl(var(--border))',
        backgroundColor: checked ? `${accent}15` : 'hsl(var(--surface-1))'
      }}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: `${accent}22` }}>
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      <span className="text-xs font-medium text-center leading-tight">{label}</span>
    </label>
  );
}

function GoalCard({ title, current, target, pct, daysRemaining, avgPace, avgPaceLabel, projectedLabel, onTrack, expectedByNow, expectedPct, behindBy, requiredRunRate, monthsLeft }) {
  return (
    <div className="border border-border rounded-md p-5 bg-[hsl(var(--surface-1))]">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold inline-block mr-2">{title}</h2>
          <span
            className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'hsl(var(--chart-3) / 0.15)', color: 'hsl(var(--chart-3))' }}
          >
            Informal target
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span
            className="font-semibold"
            style={{ color: onTrack === false ? 'hsl(var(--destructive))' : 'hsl(var(--status-complete))' }}
          >
            {onTrack === false ? 'Behind Pace' : 'On Track'}
          </span>
          <span>{daysRemaining} days remaining</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground italic mb-2">
        A personal target between Oli Williams and Christian Lett {'\u2014'} not an official company KPI.
      </p>
      <div className="relative h-6 bg-[hsl(var(--surface-2))] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: onTrack === false ? 'hsl(var(--destructive))' : 'hsl(var(--status-complete))'
          }}
        />
        {expectedPct !== undefined && (
          <div
            className="absolute top-0 h-full w-0.5 bg-[hsl(var(--foreground))]"
            style={{ left: `${expectedPct}%` }}
            title="Where we should be today for a straight-line pace to target"
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground flex-wrap gap-2">
        <span><AnimatedNumber value={current} /> of {target} ({pct.toFixed(1)}%)</span>
        {expectedByNow !== undefined && (
          <span
            className="font-medium"
            style={{ color: behindBy < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--status-complete))' }}
          >
            {behindBy < 0 ? `${Math.abs(behindBy)} behind pace` : behindBy > 0 ? `${behindBy} ahead of pace` : 'Exactly on pace'} (expected {expectedByNow} by today)
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {avgPaceLabel || 'Avg pace'}: {avgPace}/month
        {projectedLabel && <> {'\u2014'} projected to hit {target.toLocaleString()} by {projectedLabel}</>}
      </div>
      {requiredRunRate !== undefined && (
        <div className="text-xs mt-1" style={{ color: requiredRunRate > avgPace ? 'hsl(var(--destructive))' : 'hsl(var(--status-complete))' }}>
          Required pace to hit target: {requiredRunRate}/month over the remaining {monthsLeft} month{monthsLeft === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refetching, setRefetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartView, setChartView] = useState('monthly');
  const [expandedCard, setExpandedCard] = useState(null); // { ym, type: 'live' | 'scheduled', label }
  const [expandedBauCell, setExpandedBauCell] = useState(null); // { monthKey, cluster, category, label }
  const [activeTab, setActiveTab] = useState('forecast');
  const [signUpItems, setSignUpItems] = useState(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => refresh(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Re-render every 30s purely so "Updated X ago" stays current without
  // needing a new data fetch.
  useEffect(() => {
    const tick = setInterval(() => forceTick((n) => n + 1), 30 * 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    function handleChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [countryData, signUpData] = await Promise.all([fetchCountryItems(), fetchSignUpItems()]);
      setItems(countryData);
      setSignUpItems(signUpData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefetching(true);
    try {
      const [countryData, signUpData] = await Promise.all([fetchCountryItems(), fetchSignUpItems()]);
      setItems(countryData);
      setSignUpItems(signUpData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setRefetching(false);
    }
  }

  function timeAgo(date) {
    if (!date) return '';
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  // Top-line counts are completed/live installs only (matching each
  // board's status or Group as classified by isLiveItem), not every item
  // in the pipeline regardless of status.
  const countryCompletedCounts = useMemo(() => {
    const counts = {};
    COUNTRIES.forEach((c) => { counts[c] = 0; });
    items
      .filter(isLiveItem)
      .forEach((i) => { counts[i.country] = (counts[i.country] || 0) + 1; });
    return counts;
  }, [items]);

  const totalSites = useMemo(
    () => Object.values(countryCompletedCounts).reduce((sum, n) => sum + n, 0),
    [countryCompletedCounts]
  );

  const countryShareData = useMemo(
    () => COUNTRIES.map((c) => ({ country: c, label: c, count: countryCompletedCounts[c] || 0 })),
    [countryCompletedCounts]
  );

  // ---- Subway Pipeline Forecast: Interrupt / Disrupt / Small Format
  // kiosk counts by country, sourced entirely from the Sign Up \u2192 Ready to
  // Go board's own "Layout Type" column and its own "Country" field \u2014
  // deliberately independent of the 5 country boards used everywhere else
  // on this dashboard, per how this particular breakdown is tracked. ----
  const pipelineForecast = useMemo(() => {
    const normalizeCountry = (text) => {
      const t = (text || '').trim().toLowerCase();
      if (!t) return null;
      if (t.includes('united kingdom') || t === 'uk' || t === 'gb') return 'UK';
      if (t.includes('ireland')) return 'IE';
      if (t.includes('netherlands') || t === 'nl') return 'NL';
      if (t.includes('germany') || t === 'de') return 'DE';
      if (t.includes('finland') || t === 'fi') return 'FI';
      return null;
    };
    const classifyLayout = (text) => {
      const t = (text || '').trim().toLowerCase();
      // Layout Type on the board has been simplified down to exactly
      // these 3 options, so exact matching is enough now \u2014 no more
      // "Subway Disrupt 2.0" / "D2.0 BAU" / "Flyte 22\" Kiosks" variants
      // to account for separately.
      if (t === 'interrupt') return 'interrupt';
      if (t === 'disrupt') return 'disrupt';
      if (t === 'small form factor') return 'smallFormat';
      return null;
    };

    // Layout Type lives on the Sign Up board and covers every record ever
    // created there, regardless of whether that site has actually gone
    // live yet \u2014 so this needs to be cross-checked against the linked
    // country-board item's real live status, the same way reconciliation
    // does it, or the totals wildly overcount vs "Total Sites Live".
    const normalizeName = (n) => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const liveItemsByNormName = new Map(
      items.filter(isLiveItem).map((i) => [normalizeName(i.name), i])
    );
    // Reverse lookup: index live country items by whatever Sign Up names
    // THEY link back to. Monday's link columns are sometimes only
    // reliably populated on one side of a relationship \u2014 a Sign Up
    // record's own link field can be empty even though the country
    // board's own link back to it works fine. Checking both directions
    // catches sites that the forward-only check alone would miss.
    const liveItemByOwnSignUpLinkName = new Map();
    items.filter(isLiveItem).forEach((i) => {
      i.linkedSignUpNames.forEach((n) => {
        liveItemByOwnSignUpLinkName.set(normalizeName(n), i);
      });
    });

    // A given live site can occasionally be reachable via more than one
    // Sign Up record (we've seen genuine "(copy)" duplicates on that
    // board) \u2014 tracking counted site IDs per category means a duplicate
    // record pointing at the same real site is never counted twice.
    const counts = { interrupt: {}, disrupt: {}, smallFormat: {} };
    const countedSiteIds = { interrupt: new Set(), disrupt: new Set(), smallFormat: new Set() };
    COUNTRIES.forEach((c) => { counts.interrupt[c] = 0; counts.disrupt[c] = 0; counts.smallFormat[c] = 0; });

    (signUpItems || []).forEach((item) => {
      const country = normalizeCountry(item.country);
      const category = classifyLayout(item.layoutType);
      if (!country || !category) return;

      let liveSite = item.linkedInstallBauNames
        .map((n) => liveItemsByNormName.get(normalizeName(n)))
        .find(Boolean);
      if (!liveSite) {
        liveSite = liveItemByOwnSignUpLinkName.get(normalizeName(item.name));
      }
      if (!liveSite) return;
      if (countedSiteIds[category].has(liveSite.id)) return;

      countedSiteIds[category].add(liveSite.id);
      counts[category][country] += 1;
    });

    const totalOf = (row) => COUNTRIES.reduce((sum, c) => sum + (row[c] || 0), 0);
    const allCountedSiteIds = new Set([
      ...countedSiteIds.interrupt, ...countedSiteIds.disrupt, ...countedSiteIds.smallFormat
    ]);
    return {
      interrupt: { ...counts.interrupt, Total: totalOf(counts.interrupt) },
      disrupt: { ...counts.disrupt, Total: totalOf(counts.disrupt) },
      smallFormat: { ...counts.smallFormat, Total: totalOf(counts.smallFormat) },
      allCountedSiteIds
    };
  }, [signUpItems, items]);

  // ---- Active Pipeline Breakdown: Install Phase stage counts, clustered
  // into UKI (UK+Ireland) and DE/NL (Germany+Netherlands) \u2014 Finland has no
  // further pipeline activity so it's excluded here, same as the Scheduled
  // vs Actual table. Sourced from the same Sign Up board Install Phase
  // field already fetched for reconciliation \u2014 real labels are numbered
  // e.g. "4. HW Placement Approval", "9. Implementing". ----
  const activePipelineBreakdown = useMemo(() => {
    const normalizeCountry = (text) => {
      const t = (text || '').trim().toLowerCase();
      if (!t) return null;
      if (t.includes('united kingdom') || t === 'uk' || t === 'gb') return 'UK';
      if (t.includes('ireland')) return 'IE';
      if (t.includes('netherlands') || t === 'nl') return 'NL';
      if (t.includes('germany') || t === 'de') return 'DE';
      if (t.includes('finland') || t === 'fi') return 'FI';
      return null;
    };
    const classifyStage = (text) => {
      const t = (text || '').trim().toLowerCase();
      if (t.includes('hw placement approval') || t.includes('hardware placement approval')) return 'hwPlacement';
      if (t.includes('imp readiness')) return 'impReadiness';
      if (t.includes('contract signed')) return 'contractSigned';
      if (t.includes('implementing')) return 'implementing';
      if (t.includes('installing')) return 'installing';
      return null;
    };
    const clusterOf = (country) => {
      if (country === 'UK' || country === 'IE') return 'UKI';
      if (country === 'DE') return 'DE';
      if (country === 'NL') return 'NL';
      return null;
    };

    const blank = () => ({ hwPlacement: 0, impReadiness: 0, contractSigned: 0, implementing: 0, installing: 0 });
    const counts = { UKI: blank(), DE: blank(), NL: blank() };

    (signUpItems || []).forEach((item) => {
      // Sites parked in "Blocked/Frozen & Unblockable Sites" are excluded
      // entirely from this breakdown, regardless of their own stage.
      const group = (item.group || '').toLowerCase();
      if (group.includes('blocked') && group.includes('unblockable')) return;

      const cluster = clusterOf(normalizeCountry(item.country));
      const stage = classifyStage(item.installPhase);
      if (!cluster || !stage) return;
      counts[cluster][stage] += 1;
    });

    const totalOf = (row) => Object.values(row).reduce((sum, n) => sum + n, 0);
    return {
      UKI: { ...counts.UKI, total: totalOf(counts.UKI) },
      DE: { ...counts.DE, total: totalOf(counts.DE) },
      NL: { ...counts.NL, total: totalOf(counts.NL) }
    };
  }, [signUpItems]);

  // ---- BAU Forecast tables (This Month "Actual" / Next Month "Forecast"):
  // Remodel/NRO and RetroFit come from the Sign Up board's Store Opening
  // Type field — Remodel/NRO by Expect Remodel Month, RetroFit by its
  // "Kiosk Reposition/Relocation" are excluded entirely, and IMACs was
  // dropped from this table entirely too (was previously sourced from a
  // separate board, no longer tracked here). ----
  const bauForecastTables = useMemo(() => {
    const now = new Date();
    const normalizeCountry = (text) => {
      const t = (text || '').trim().toLowerCase();
      if (!t) return null;
      if (t.includes('united kingdom') || t === 'uk' || t === 'gb') return 'UK';
      if (t.includes('ireland')) return 'IE';
      if (t.includes('netherlands') || t === 'nl') return 'NL';
      if (t.includes('germany') || t === 'de') return 'DE';
      if (t.includes('finland') || t === 'fi') return 'FI';
      return null;
    };
    const clusterOf = (country) => {
      if (country === 'UK' || country === 'IE') return 'UKI';
      if (country === 'DE') return 'DE';
      if (country === 'NL') return 'NL';
      return null;
    };
    const classifyStoreOpeningType = (text) => {
      const t = (text || '').trim().toLowerCase();
      // "Re-Location" / "Kiosk Reposition/Relocation" are deliberately
      // excluded entirely \u2014 not counted in either category.
      if (t.includes('re-model') || t.includes('new restaurant opening')) return 'remodelNro';
      if (t.includes('retrofit')) return 'retrofit';
      return null;
    };
    const CLUSTERS = ['DE', 'UKI', 'NL'];

    function buildMonthTable(monthOffset) {
      const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const table = {};
      CLUSTERS.forEach((c) => { table[c] = { remodelNro: 0, retrofit: 0 }; });

      (signUpItems || []).forEach((item) => {
        const cluster = clusterOf(normalizeCountry(item.country));
        const category = classifyStoreOpeningType(item.storeOpeningType);
        if (!cluster || !category) return;
        // Remodel/NRO is bucketed by Expect Remodel Month; RetroFit uses
        // the Sign Up board's own (mirrored) Install Date instead \u2014
        // different fields per category, not one date for the whole table.
        const itemYm = category === 'retrofit' ? yearMonth(item.installDate) : parseExpectRemodelMonth(item.expectRemodelMonth);
        if (itemYm !== ym) return;
        table[cluster][category] += 1;
      });

      const totals = { remodelNro: 0, retrofit: 0 };
      CLUSTERS.forEach((c) => {
        totals.remodelNro += table[c].remodelNro;
        totals.retrofit += table[c].retrofit;
      });

      return { ym, label, table, totals };
    }

    return { thisMonth: buildMonthTable(0), nextMonth: buildMonthTable(1) };
  }, [signUpItems]);

  // ---- Site list for whichever BAU Forecast cell is currently expanded.
  // cluster === null means the Total Pipeline row was clicked, showing
  // every cluster's sites for that category combined. ----
  const bauCellSites = useMemo(() => {
    if (!expandedBauCell) return [];
    const { monthKey, cluster, category } = expandedBauCell;
    const monthData = bauForecastTables[monthKey];
    if (!monthData) return [];

    const normalizeCountry = (text) => {
      const t = (text || '').trim().toLowerCase();
      if (!t) return null;
      if (t.includes('united kingdom') || t === 'uk' || t === 'gb') return 'UK';
      if (t.includes('ireland')) return 'IE';
      if (t.includes('netherlands') || t === 'nl') return 'NL';
      if (t.includes('germany') || t === 'de') return 'DE';
      if (t.includes('finland') || t === 'fi') return 'FI';
      return null;
    };
    const clusterOf = (country) => {
      if (country === 'UK' || country === 'IE') return 'UKI';
      if (country === 'DE') return 'DE';
      if (country === 'NL') return 'NL';
      return null;
    };
    const classifyStoreOpeningType = (text) => {
      const t = (text || '').trim().toLowerCase();
      // "Re-Location" / "Kiosk Reposition/Relocation" are deliberately
      // excluded entirely \u2014 not counted in either category.
      if (t.includes('re-model') || t.includes('new restaurant opening')) return 'remodelNro';
      if (t.includes('retrofit')) return 'retrofit';
      return null;
    };

    return (signUpItems || [])
      .filter((item) => classifyStoreOpeningType(item.storeOpeningType) === category)
      .filter((item) => {
        const itemYm = category === 'retrofit' ? yearMonth(item.installDate) : parseExpectRemodelMonth(item.expectRemodelMonth);
        return itemYm === monthData.ym;
      })
      .map((item) => ({ ...item, countryCode: normalizeCountry(item.country) }))
      .filter((item) => {
        const itemCluster = clusterOf(item.countryCode);
        return cluster ? itemCluster === cluster : itemCluster !== null;
      })
      .sort((a, b) => (a.countryCode || '').localeCompare(b.countryCode || '') || a.name.localeCompare(b.name));
  }, [expandedBauCell, bauForecastTables, signUpItems]);

  function toggleBauCell(monthKey, cluster, category, label) {
    setExpandedBauCell((prev) =>
      prev && prev.monthKey === monthKey && prev.cluster === cluster && prev.category === category
        ? null
        : { monthKey, cluster, category, label }
    );
  }

  // ---- Priority Sites candidates: not a replacement for the manually
  // curated Priority Sites slides (those need a person's judgment and
  // commentary), but a starting shortlist of sites whose own Site Status
  // already flags a problem \u2014 using the same field already fetched from
  // all 5 country boards, so no new Monday lookup was needed. Excludes
  // sites already live, since a stale status on a finished site isn't a
  // real candidate. ----
  const stuckSiteCandidates = useMemo(() => {
    const STUCK_PATTERN = /risk|issue|hold|reschedul|outstanding|postponed/i;
    return items
      .filter((i) => !isLiveItem(i))
      .filter((i) => STUCK_PATTERN.test(i.siteStatus || ''))
      .sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  }, [items]);
  const scheduledByMonth = useMemo(() => {
    const now = new Date();
    const months = [-1, 0, 1, 2].map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long' });
      const matching = items.filter((i) => yearMonth(i.installDate) === ym);
      const installedActual = matching.filter(isLiveItem).length;
      const pct = matching.length > 0 ? Math.round((installedActual / matching.length) * 100) : null;
      const byCountry = {};
      const byCountryActual = {};
      const byCountryPct = {};
      COUNTRIES.forEach((c) => { byCountry[c] = 0; byCountryActual[c] = 0; });
      matching.forEach((i) => {
        byCountry[i.country] = (byCountry[i.country] || 0) + 1;
        if (isLiveItem(i)) byCountryActual[i.country] = (byCountryActual[i.country] || 0) + 1;
      });
      COUNTRIES.forEach((c) => {
        byCountryPct[c] = byCountry[c] > 0 ? Math.round((byCountryActual[c] / byCountry[c]) * 100) : null;
      });
      return { ym, label, offset, total: matching.length, installedActual, pct, byCountry, byCountryActual, byCountryPct };
    });
    return months;
  }, [items]);

  // ---- Site list for whichever month/type card is currently expanded ----
  const expandedSites = useMemo(() => {
    if (!expandedCard) return [];
    const matching = items.filter((i) => yearMonth(i.installDate) === expandedCard.ym);
    const filtered = expandedCard.type === 'live' ? matching.filter(isLiveItem) : matching;
    return filtered.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  }, [expandedCard, items]);

  function toggleCard(ym, type, label) {
    setExpandedCard((prev) => (prev && prev.ym === ym && prev.type === type ? null : { ym, type, label }));
  }

  // ---- Completed installs by month (trend) ----
  const monthlyCompletedRaw = useMemo(() => {
    const byMonth = {};
    items
      .filter((i) => isLiveItem(i) && i.installDate)
      .forEach((i) => {
        const ym = yearMonth(i.installDate);
        if (!ym) return;
        if (!byMonth[ym]) byMonth[ym] = { ym, count: 0 };
        byMonth[ym].count += 1;
      });
    return Object.values(byMonth).sort((a, b) => a.ym.localeCompare(b.ym));
  }, [items]);

  const monthlyCompletedData = useMemo(
    () => monthlyCompletedRaw.map((d) => ({ label: formatYearMonth(d.ym), count: d.count })),
    [monthlyCompletedRaw]
  );

  // Weekly view of the same data, capped to the last 12 weeks so the chart
  // stays readable rather than showing every week since the programme began.
  const weeklyCompletedData = useMemo(() => {
    const byWeek = {};
    items
      .filter((i) => isLiveItem(i) && i.installDate)
      .forEach((i) => {
        const wk = weekKey(i.installDate);
        if (!wk) return;
        if (!byWeek[wk]) byWeek[wk] = { wk, count: 0 };
        byWeek[wk].count += 1;
      });
    return Object.values(byWeek)
      .sort((a, b) => a.wk.localeCompare(b.wk))
      .slice(-12)
      .map((d) => ({ label: formatWeekLabel(d.wk), count: d.count }));
  }, [items]);

  // Actual total as of 1/3/6/12 months ago \u2014 reconstructed from each
  // site's own Install Date rather than a separate snapshot/history store.
  const historicalTotals = useMemo(() => {
    const now = new Date();
    const cumulativeAsOf = (cutoff) =>
      items.filter((i) => isLiveItem(i) && i.installDate && new Date(i.installDate) <= cutoff).length;

    return [1, 3, 6, 12].map((months) => {
      const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
      return { label: `${months} mo ago`, total: cumulativeAsOf(cutoff) };
    });
  }, [items]);

  // ---- Per-country cumulative growth, last 6 data points \u2014 powers the
  // sparkline on each country card ----
  const countryTrends = useMemo(() => {
    const byCountry = {};
    COUNTRIES.forEach((c) => { byCountry[c] = {}; });
    items
      .filter((i) => isLiveItem(i) && i.installDate)
      .forEach((i) => {
        const ym = yearMonth(i.installDate);
        if (!ym) return;
        byCountry[i.country][ym] = (byCountry[i.country][ym] || 0) + 1;
      });
    const result = {};
    COUNTRIES.forEach((c) => {
      const sortedYms = Object.keys(byCountry[c]).sort();
      let running = 0;
      const cumulative = sortedYms.map((ym) => {
        running += byCountry[c][ym];
        return { ym, value: running };
      });
      result[c] = cumulative.slice(-6);
    });
    return result;
  }, [items]);

  // ---- Scheduled by month, stacked by country \u2014 covers both history and
  // the near-term future, using every item's Install Date regardless of
  // current status (unlike the "Completed" chart above) ----
  const scheduledMonthlyData = useMemo(() => {
    const byMonth = {};
    items.forEach((i) => {
      const ym = yearMonth(i.installDate);
      if (!ym) return;
      if (!byMonth[ym]) {
        byMonth[ym] = { ym };
        COUNTRIES.forEach((c) => { byMonth[ym][c] = 0; });
      }
      byMonth[ym][i.country] = (byMonth[ym][i.country] || 0) + 1;
    });
    return Object.values(byMonth)
      .sort((a, b) => a.ym.localeCompare(b.ym))
      .map((d) => ({ ...d, label: formatYearMonth(d.ym) }));
  }, [items]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md border border-border rounded-md p-6 bg-[hsl(var(--surface-1))]">
          <div className="flex items-center gap-2 mb-2 text-[hsl(var(--destructive))]">
            <AlertCircle className="w-4 h-4" />
            <h2 className="text-sm font-semibold">Couldn't load the dashboard</h2>
          </div>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button size="sm" className="mt-4" onClick={load}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/Vita Mojo_Primary_Dark.png" alt="Vita Mojo" className="h-8 w-auto" />
            <div className="h-8 w-px bg-border" />
            <img src="/Subway.png" alt="Subway" className="h-8 w-auto" />
            <div className="h-8 w-px bg-border" />
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight leading-tight">PipelineBoard</h1>
              <p className="text-xs text-muted-foreground">Weekly pipeline forecast review</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {!loading && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total Sites (Live)</div>
                <div className="text-4xl font-bold tabular-nums leading-none"><AnimatedNumber value={totalSites} /></div>
                {historicalTotals.length > 0 && (
                  <div className="flex items-center justify-end gap-2 mt-1">
                    {historicalTotals.map((h) => (
                      <span
                        key={h.label}
                        className="text-xs font-medium px-1.5 py-0.5 rounded bg-[hsl(var(--surface-2))]"
                      >
                        {h.total} <span className="text-muted-foreground font-normal">({h.label})</span>
                      </span>
                    ))}
                  </div>
                )}
                {lastUpdated && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">Updated {timeAgo(lastUpdated)}</div>
                )}
              </div>
            )}
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 no-print" onClick={toggleFullscreen} title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs w-fit no-print" onClick={refresh} disabled={refetching}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs w-fit no-print" onClick={() => window.print()}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm text-muted-foreground">Building your dashboard{'\u2026'}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {refetching && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-[hsl(var(--surface-1))] border border-border rounded-md py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="ml-1">Updating dashboard{'\u2026'}</span>
              </div>
            )}

            {/* ---- Last month final tally, current / next / +2 month callouts, FTR placeholder ---- */}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <KPICard
                label={`Live \u2014 ${scheduledByMonth[0]?.label}`}
                value={scheduledByMonth[0]?.installedActual ?? 0}
                hero
                type="live"
                onClick={() => toggleCard(scheduledByMonth[0]?.ym, 'live', scheduledByMonth[0]?.label)}
                active={expandedCard?.ym === scheduledByMonth[0]?.ym && expandedCard?.type === 'live'}
              />
              <KPICard
                label={`Scheduled \u2014 ${scheduledByMonth[1]?.label}`}
                value={scheduledByMonth[1]?.total ?? 0}
                hero
                type="scheduled"
                onClick={() => toggleCard(scheduledByMonth[1]?.ym, 'scheduled', scheduledByMonth[1]?.label)}
                active={expandedCard?.ym === scheduledByMonth[1]?.ym && expandedCard?.type === 'scheduled'}
              />
              <KPICard
                label={`Live \u2014 ${scheduledByMonth[1]?.label}`}
                value={`${scheduledByMonth[1]?.installedActual ?? 0}${scheduledByMonth[1]?.pct !== null ? ` (${scheduledByMonth[1]?.pct}%)` : ''}`}
                hero
                type="live"
                onClick={() => toggleCard(scheduledByMonth[1]?.ym, 'live', scheduledByMonth[1]?.label)}
                active={expandedCard?.ym === scheduledByMonth[1]?.ym && expandedCard?.type === 'live'}
              />
              {scheduledByMonth.slice(2).map((m) => (
                <KPICard
                  key={m.ym}
                  label={`Scheduled \u2014 ${m.label}`}
                  value={m.total}
                  hero
                  type="scheduled"
                  onClick={() => toggleCard(m.ym, 'scheduled', m.label)}
                  active={expandedCard?.ym === m.ym && expandedCard?.type === 'scheduled'}
                />
              ))}
            </div>

            {expandedCard && (
              <div className="border border-primary rounded-md bg-[hsl(var(--surface-1))]">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    {expandedCard.type === 'live' ? 'Live' : 'Scheduled'} {'\u2014'} {expandedCard.label} ({expandedSites.length} site{expandedSites.length === 1 ? '' : 's'})
                  </h3>
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setExpandedCard(null)}>
                    Close {'\u2715'}
                  </button>
                </div>
                <div className="p-4">
                  {expandedSites.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1">No sites found.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {expandedSites.map((s) => (
                        <span
                          key={`${s.country}-${s.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[hsl(var(--surface-2))] text-xs"
                        >
                          <span>{FLAGS[s.country]}</span>
                          <span className="font-medium">{s.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 no-print">
              {SECTION_TABS.map((tab) => (
                <SectionTabRadio
                  key={tab.key}
                  name="section-tab"
                  checked={activeTab === tab.key}
                  onChange={() => setActiveTab(tab.key)}
                  icon={tab.icon}
                  label={tab.label}
                  accent={tab.accent}
                />
              ))}
            </div>

            <SectionCard
              icon={CalendarCheck}
              accent="hsl(var(--chart-4))"
              title="Scheduled vs Actual by Country"
              open={activeTab === 'scheduled'}
              footer="Each cell shows the hit rate, with the raw counts underneath — ✓ = Live, 📅 = Scheduled."
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[hsl(var(--surface-2))] border-b border-border">
                    <tr>
                      <th className="px-5 py-3 text-left text-base font-medium text-muted-foreground">Country</th>
                      {scheduledByMonth.map((m) => (
                        <th key={m.ym} className="px-5 py-3 text-center text-base font-medium text-muted-foreground border-l border-border">
                          {m.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {SCHEDULE_TABLE_COUNTRIES.map((c) => (
                      <tr key={c} className="hover:bg-[hsl(var(--surface-2))] transition-colors">
                        <td className="px-5 py-4 text-base font-semibold">{FLAGS[c]} {c}</td>
                        {scheduledByMonth.map((m) => {
                          const sched = m.byCountry[c] || 0;
                          const actual = m.byCountryActual[c] || 0;
                          const pct = m.byCountryPct[c];
                          const pctColor = pct === null
                            ? 'hsl(var(--muted-foreground))'
                            : pct >= 100
                            ? 'hsl(var(--status-complete))'
                            : pct >= 50
                            ? 'hsl(var(--status-scheduled))'
                            : 'hsl(var(--destructive))';
                          return (
                            <td
                              key={m.ym}
                              className="px-5 py-4 text-center border-l border-border"
                              style={{ backgroundColor: pct === null ? 'transparent' : `${pctColor}18` }}
                            >
                              <div className="text-xl font-bold tabular-nums" style={{ color: pctColor }}>
                                {pct === null ? '\u2014' : `${pct}%`}
                              </div>
                              <div className="flex items-center justify-center gap-2.5 text-sm text-muted-foreground tabular-nums mt-1">
                                <span className="inline-flex items-center gap-1" title="Live">
                                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--status-complete))' }} />
                                  {actual}
                                </span>
                                <span className="inline-flex items-center gap-1" title="Scheduled">
                                  <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--status-scheduled))' }} />
                                  {sched}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              icon={Package}
              accent="hsl(var(--chart-1))"
              title="Estate Overview"
              open={activeTab === 'forecast'}
            >
              <div className="px-5 py-4 border-b border-border flex items-baseline gap-3">
                <span className="text-4xl font-bold tabular-nums">
                  {pipelineForecast.interrupt.Total + pipelineForecast.disrupt.Total + pipelineForecast.smallFormat.Total}
                </span>
                <span className="text-sm text-muted-foreground">Estate Total (Interrupt + Disrupt + Small Format)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[hsl(var(--surface-2))] border-b border-border">
                    <tr>
                      <th className="px-5 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                      {FORECAST_COLUMN_ORDER.map((c) => (
                        <th key={c} className="px-5 py-3 text-center text-sm font-medium text-muted-foreground border-l border-border">
                          {FLAGS[c]} {COUNTRY_DISPLAY_NAME[c]}
                        </th>
                      ))}
                      <th className="px-5 py-3 text-center text-sm font-semibold border-l border-border">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="hover:bg-[hsl(var(--surface-2))] transition-colors">
                      <td className="px-5 py-3 text-sm font-medium">Total Sites Live</td>
                      {FORECAST_COLUMN_ORDER.map((c) => (
                        <td key={c} className="px-5 py-3 text-sm text-center tabular-nums border-l border-border">{countryCompletedCounts[c] || 0}</td>
                      ))}
                      <td className="px-5 py-3 text-sm text-center font-semibold tabular-nums border-l border-border">{totalSites}</td>
                    </tr>
                    <tr className="hover:bg-[hsl(var(--surface-2))] transition-colors">
                      <td className="px-5 py-3 text-sm font-medium">Interrupt Kiosks</td>
                      {FORECAST_COLUMN_ORDER.map((c) => (
                        <td key={c} className="px-5 py-3 text-sm text-center tabular-nums border-l border-border">{pipelineForecast.interrupt[c] || 0}</td>
                      ))}
                      <td className="px-5 py-3 text-sm text-center font-semibold tabular-nums border-l border-border">{pipelineForecast.interrupt.Total}</td>
                    </tr>
                    <tr className="hover:bg-[hsl(var(--surface-2))] transition-colors">
                      <td className="px-5 py-3 text-sm font-medium">Disrupt Kiosks</td>
                      {FORECAST_COLUMN_ORDER.map((c) => (
                        <td key={c} className="px-5 py-3 text-sm text-center tabular-nums border-l border-border">{pipelineForecast.disrupt[c] || 0}</td>
                      ))}
                      <td className="px-5 py-3 text-sm text-center font-semibold tabular-nums border-l border-border">{pipelineForecast.disrupt.Total}</td>
                    </tr>
                    <tr className="hover:bg-[hsl(var(--surface-2))] transition-colors">
                      <td className="px-5 py-3 text-sm font-medium">Small Format Kiosks</td>
                      {FORECAST_COLUMN_ORDER.map((c) => (
                        <td key={c} className="px-5 py-3 text-sm text-center tabular-nums border-l border-border">{pipelineForecast.smallFormat[c] || 0}</td>
                      ))}
                      <td className="px-5 py-3 text-sm text-center font-semibold tabular-nums border-l border-border">{pipelineForecast.smallFormat.Total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              icon={Workflow}
              accent="hsl(var(--chart-2))"
              title="Active Pipeline Breakdown"
              open={activeTab === 'active'}
              footer="Stage counts come from the Sign Up → Ready to Go board's Install Phase field. Finland is excluded, matching how the rest of this dashboard treats it (no further pipeline activity), as are any sites sitting in “Blocked/Frozen & Unblockable Sites.”"
            >
              <div className="p-5 grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {[
                  { key: 'UKI', label: 'UKI Pipeline' },
                  { key: 'DE', label: 'DE Pipeline' },
                  { key: 'NL', label: 'NL Pipeline' }
                ].map(({ key, label }) => {
                  const row = activePipelineBreakdown[key];
                  const stageRows = [
                    ['Hardware Placement Approval', row.hwPlacement],
                    ['Contract/Invoice Sent', row.impReadiness],
                    ['Contract Signed', row.contractSigned],
                    ['Implementing without Install Date', row.implementing],
                    ['Installing', row.installing]
                  ];
                  return (
                    <div key={key} className="border border-border rounded-md overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-[hsl(var(--surface-2))] border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold" colSpan={2}>{label}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {stageRows.map(([stageLabel, count]) => (
                            <tr key={stageLabel}>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{stageLabel}</td>
                              <td className="px-4 py-3 text-sm text-right tabular-nums">{count}</td>
                            </tr>
                          ))}
                          <tr className="bg-[hsl(var(--surface-2))]">
                            <td className="px-4 py-3 text-sm font-semibold">Total Active Pipeline</td>
                            <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">{row.total}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard
              icon={ClipboardList}
              accent="hsl(var(--chart-5))"
              title="BAU Forecast — Remodel/NRO, RetroFit"
              open={activeTab === 'bau'}
              footer="Remodel/NRO and RetroFit come from the Sign Up board's Store Opening Type field — Remodel/NRO is bucketed by Expect Remodel Month, RetroFit by the board's own Install Date. “Re-Location” and “Kiosk Reposition/Relocation” are excluded entirely. Click any number to see the sites behind it."
            >
              <div className="p-5 grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                {[
                  { key: 'thisMonth', badge: 'Actual' },
                  { key: 'nextMonth', badge: 'Forecast' }
                ].map(({ key, badge }) => {
                  const { label, table, totals } = bauForecastTables[key];
                  const clusterRows = [
                    ['DE', 'DE BAU'],
                    ['UKI', 'UKI BAU'],
                    ['NL', 'NL BAU']
                  ];
                  const categoryLabels = { remodelNro: 'Remodel/NRO', retrofit: 'RetroFit' };
                  const cellClass = (cluster, category) => {
                    const isActive = expandedBauCell?.monthKey === key && expandedBauCell?.cluster === cluster && expandedBauCell?.category === category;
                    return `px-3 py-3 text-sm text-center tabular-nums cursor-pointer transition-colors hover:bg-[hsl(var(--surface-2))] ${isActive ? 'text-primary font-semibold' : ''}`;
                  };
                  return (
                    <div key={key} className="border border-border rounded-md overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-[hsl(var(--surface-2))] border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold">
                              {label} <span className="font-normal text-muted-foreground">({badge})</span>
                            </th>
                            <th className="px-3 py-3 text-center text-sm font-medium text-muted-foreground">Remodel/NRO</th>
                            <th className="px-3 py-3 text-center text-sm font-medium text-muted-foreground">RetroFit</th>
                            <th className="px-3 py-3 text-center text-sm font-semibold border-l border-border">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {clusterRows.map(([clusterKey, rowLabel]) => (
                            <tr key={clusterKey}>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{rowLabel}</td>
                              {['remodelNro', 'retrofit'].map((category) => (
                                <td
                                  key={category}
                                  className={cellClass(clusterKey, category)}
                                  onClick={() => toggleBauCell(key, clusterKey, category, `${rowLabel} \u2014 ${categoryLabels[category]}`)}
                                >
                                  {table[clusterKey][category]}
                                </td>
                              ))}
                              <td className="px-3 py-3 text-sm text-center font-semibold tabular-nums border-l border-border">
                                {table[clusterKey].remodelNro + table[clusterKey].retrofit}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-[hsl(var(--surface-2))]">
                            <td className="px-4 py-3 text-sm font-semibold">Total Pipeline</td>
                            {['remodelNro', 'retrofit'].map((category) => (
                              <td
                                key={category}
                                className={`${cellClass(null, category)} font-semibold`}
                                onClick={() => toggleBauCell(key, null, category, `Total Pipeline \u2014 ${categoryLabels[category]}`)}
                              >
                                {totals[category]}
                              </td>
                            ))}
                            <td className="px-3 py-3 text-sm text-center font-semibold tabular-nums border-l border-border">
                              {totals.remodelNro + totals.retrofit}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="px-4 py-3 border-t border-border text-sm">
                        <span className="text-muted-foreground">Forecast: </span>
                        <span className="font-semibold tabular-nums">
                          {totals.remodelNro + totals.retrofit}
                        </span>
                      </div>
                      {expandedBauCell?.monthKey === key && (
                        <div className="border-t border-primary p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">
                              {expandedBauCell.label} {'\u2014'} {label} ({bauCellSites.length} site{bauCellSites.length === 1 ? '' : 's'})
                            </h4>
                            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setExpandedBauCell(null)}>
                              Close {'\u2715'}
                            </button>
                          </div>
                          {bauCellSites.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No sites found.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {bauCellSites.map((s) => (
                                <span
                                  key={s.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[hsl(var(--surface-2))] text-xs"
                                >
                                  <span>{FLAGS[s.countryCode] || '\u{1F310}'}</span>
                                  <span className="font-medium">{s.name}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard
              icon={AlertTriangle}
              accent="hsl(var(--destructive))"
              title={`Priority Sites \u2014 Candidates (${stuckSiteCandidates.length})`}
              open={activeTab === 'priority'}
              footer="A starting shortlist, not the finished Priority Sites slide — these are sites whose own Site Status already flags a problem (risk, hold, reschedule, outstanding payment, etc.), pulled straight from each country board. Still needs a person's judgement on which are genuinely priority, plus the commentary and owner for each."
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[hsl(var(--surface-2))] border-b border-border">
                    <tr>
                      <th className="px-5 py-3 text-left text-sm font-medium text-muted-foreground">Site</th>
                      <th className="px-5 py-3 text-left text-sm font-medium text-muted-foreground">Country</th>
                      <th className="px-5 py-3 text-left text-sm font-medium text-muted-foreground">Site Status</th>
                      <th className="px-5 py-3 text-left text-sm font-medium text-muted-foreground">Install Phase</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stuckSiteCandidates.length === 0 ? (
                      <tr><td colSpan={4} className="px-5 py-4 text-sm text-muted-foreground">No sites currently flagged.</td></tr>
                    ) : stuckSiteCandidates.map((site) => (
                      <tr key={`${site.country}-${site.id}`} className="hover:bg-[hsl(var(--surface-2))] transition-colors">
                        <td className="px-5 py-3 text-sm font-medium">{site.name}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{FLAGS[site.country]} {site.country}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{site.siteStatus || '\u2014'}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{site.installPhase || '\u2014'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}
      </main>
    </div>
  );
}
