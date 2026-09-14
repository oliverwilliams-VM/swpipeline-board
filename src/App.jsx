import { useState, useEffect, useMemo } from 'react';
import { Button } from './components/ui/button';
import { AlertCircle, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
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

function KPICard({ label, value, hero = false, onClick, active = false }) {
  return (
    <div
      className={`border rounded-md p-4 bg-[hsl(var(--surface-1))] transition-colors ${
        onClick ? 'cursor-pointer hover:border-primary' : ''
      } ${active ? 'border-primary' : 'border-border'}`}
      onClick={onClick}
    >
      <div className="text-xs text-muted-foreground mb-2 line-clamp-2">{label}</div>
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
      // Real board labels are e.g. "Interrupt 27\" Kiosk" and "Disrupt 27\"
      // Kiosk" \u2014 startsWith catches these regardless of the kiosk-size
      // suffix, while deliberately NOT matching "Subway Disrupt 2.0" (that
      // starts with "subway", so it stays its own separate thing rather
      // than getting folded into plain "Disrupt").
      if (t.startsWith('interrupt')) return 'interrupt';
      if (t.startsWith('disrupt')) return 'disrupt';
      if (t.includes('small')) return 'smallFormat'; // covers "Small Form Factor" / "Small Format" / "Small Factor"
      return null;
    };

    const counts = { interrupt: {}, disrupt: {}, smallFormat: {} };
    COUNTRIES.forEach((c) => { counts.interrupt[c] = 0; counts.disrupt[c] = 0; counts.smallFormat[c] = 0; });

    (signUpItems || []).forEach((item) => {
      const country = normalizeCountry(item.country);
      const category = classifyLayout(item.layoutType);
      if (!country || !category) return;
      counts[category][country] += 1;
    });

    const totalOf = (row) => COUNTRIES.reduce((sum, c) => sum + (row[c] || 0), 0);
    return {
      interrupt: { ...counts.interrupt, Total: totalOf(counts.interrupt) },
      disrupt: { ...counts.disrupt, Total: totalOf(counts.disrupt) },
      smallFormat: { ...counts.smallFormat, Total: totalOf(counts.smallFormat) }
    };
  }, [signUpItems]);

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
      if (country === 'DE' || country === 'NL') return 'DE_NL';
      return null;
    };

    const blank = () => ({ hwPlacement: 0, impReadiness: 0, contractSigned: 0, implementing: 0, installing: 0 });
    const counts = { UKI: blank(), DE_NL: blank() };

    (signUpItems || []).forEach((item) => {
      const cluster = clusterOf(normalizeCountry(item.country));
      const stage = classifyStage(item.installPhase);
      if (!cluster || !stage) return;
      counts[cluster][stage] += 1;
    });

    const totalOf = (row) => Object.values(row).reduce((sum, n) => sum + n, 0);
    return {
      UKI: { ...counts.UKI, total: totalOf(counts.UKI) },
      DE_NL: { ...counts.DE_NL, total: totalOf(counts.DE_NL) }
    };
  }, [signUpItems]);

  // ---- Current / next / month-after install volume, based on each site's
  // real Install Date rather than group names (more reliable across boards) ----
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between max-w-[1440px] mx-auto">
          <div className="flex items-center gap-3">
            <img src="/Vita Mojo_Primary_Dark.png" alt="Vita Mojo" className="h-8 w-auto" />
            <div className="h-8 w-px bg-border" />
            <img src="/Subway.png" alt="Subway" className="h-8 w-auto" />
            <div className="h-8 w-px bg-border" />
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">PipelineBoard</h1>
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
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={toggleFullscreen} title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs w-fit" onClick={refresh} disabled={refetching}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-4 sm:py-6 max-w-[1440px] mx-auto space-y-6">
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
                onClick={() => toggleCard(scheduledByMonth[0]?.ym, 'live', scheduledByMonth[0]?.label)}
                active={expandedCard?.ym === scheduledByMonth[0]?.ym && expandedCard?.type === 'live'}
              />
              <KPICard
                label={`Scheduled \u2014 ${scheduledByMonth[1]?.label}`}
                value={scheduledByMonth[1]?.total ?? 0}
                hero
                onClick={() => toggleCard(scheduledByMonth[1]?.ym, 'scheduled', scheduledByMonth[1]?.label)}
                active={expandedCard?.ym === scheduledByMonth[1]?.ym && expandedCard?.type === 'scheduled'}
              />
              <KPICard
                label={`Live \u2014 ${scheduledByMonth[1]?.label}`}
                value={`${scheduledByMonth[1]?.installedActual ?? 0}${scheduledByMonth[1]?.pct !== null ? ` (${scheduledByMonth[1]?.pct}%)` : ''}`}
                hero
                onClick={() => toggleCard(scheduledByMonth[1]?.ym, 'live', scheduledByMonth[1]?.label)}
                active={expandedCard?.ym === scheduledByMonth[1]?.ym && expandedCard?.type === 'live'}
              />
              {scheduledByMonth.slice(2).map((m) => (
                <KPICard
                  key={m.ym}
                  label={`Scheduled \u2014 ${m.label}`}
                  value={m.total}
                  hero
                  onClick={() => toggleCard(m.ym, 'scheduled', m.label)}
                  active={expandedCard?.ym === m.ym && expandedCard?.type === 'scheduled'}
                />
              ))}
              <PlaceholderCard label="First Time Right" />
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

            <div className="border border-border rounded-md bg-[hsl(var(--surface-1))]">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Subway Pipeline Forecast</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[hsl(var(--surface-2))] border-b border-border">
                    <tr>
                      <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                      {FORECAST_COLUMN_ORDER.map((c) => (
                        <th key={c} className="px-5 py-2.5 text-center text-xs font-medium text-muted-foreground border-l border-border">
                          {FLAGS[c]} {COUNTRY_DISPLAY_NAME[c]}
                        </th>
                      ))}
                      <th className="px-5 py-2.5 text-center text-xs font-semibold border-l border-border">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="hover:bg-[hsl(var(--surface-2))] transition-colors">
                      <td className="px-5 py-3 text-xs font-medium">Total Sites Live</td>
                      {FORECAST_COLUMN_ORDER.map((c) => (
                        <td key={c} className="px-5 py-3 text-xs text-center tabular-nums border-l border-border">{countryCompletedCounts[c] || 0}</td>
                      ))}
                      <td className="px-5 py-3 text-xs text-center font-semibold tabular-nums border-l border-border">{totalSites}</td>
                    </tr>
                    <tr className="hover:bg-[hsl(var(--surface-2))] transition-colors">
                      <td className="px-5 py-3 text-xs font-medium">Interrupt Kiosks</td>
                      {FORECAST_COLUMN_ORDER.map((c) => (
                        <td key={c} className="px-5 py-3 text-xs text-center tabular-nums border-l border-border">{pipelineForecast.interrupt[c] || 0}</td>
                      ))}
                      <td className="px-5 py-3 text-xs text-center font-semibold tabular-nums border-l border-border">{pipelineForecast.interrupt.Total}</td>
                    </tr>
                    <tr className="hover:bg-[hsl(var(--surface-2))] transition-colors">
                      <td className="px-5 py-3 text-xs font-medium">Disrupt Kiosks</td>
                      {FORECAST_COLUMN_ORDER.map((c) => (
                        <td key={c} className="px-5 py-3 text-xs text-center tabular-nums border-l border-border">{pipelineForecast.disrupt[c] || 0}</td>
                      ))}
                      <td className="px-5 py-3 text-xs text-center font-semibold tabular-nums border-l border-border">{pipelineForecast.disrupt.Total}</td>
                    </tr>
                    <tr className="hover:bg-[hsl(var(--surface-2))] transition-colors">
                      <td className="px-5 py-3 text-xs font-medium">Small Format Kiosks</td>
                      {FORECAST_COLUMN_ORDER.map((c) => (
                        <td key={c} className="px-5 py-3 text-xs text-center tabular-nums border-l border-border">{pipelineForecast.smallFormat[c] || 0}</td>
                      ))}
                      <td className="px-5 py-3 text-xs text-center font-semibold tabular-nums border-l border-border">{pipelineForecast.smallFormat.Total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border">
                Interrupt / Disrupt / Small Format counts come from the Sign Up → Ready to Go board's Layout Type field — a different source to the Total Sites Live row above, which uses the 5 country boards.
              </p>
            </div>

            <div className="border border-border rounded-md bg-[hsl(var(--surface-1))]">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Active Pipeline Breakdown</h3>
              </div>
              <div className="p-5 grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {[
                  { key: 'UKI', label: 'UKI Pipeline' },
                  { key: 'DE_NL', label: 'DE/NL Pipeline' }
                ].map(({ key, label }) => {
                  const row = activePipelineBreakdown[key];
                  const stageRows = [
                    ['Hardware Placement Approval', row.hwPlacement],
                    ['Imp Readiness', row.impReadiness],
                    ['Contract Signed', row.contractSigned],
                    ['Implementing without Install Date', row.implementing],
                    ['Installing', row.installing]
                  ];
                  return (
                    <div key={key} className="border border-border rounded-md overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-[hsl(var(--surface-2))] border-b border-border">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold" colSpan={2}>{label}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {stageRows.map(([stageLabel, count]) => (
                            <tr key={stageLabel}>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{stageLabel}</td>
                              <td className="px-4 py-2.5 text-xs text-right tabular-nums">{count}</td>
                            </tr>
                          ))}
                          <tr className="bg-[hsl(var(--surface-2))]">
                            <td className="px-4 py-2.5 text-xs font-semibold">Total Active Pipeline</td>
                            <td className="px-4 py-2.5 text-xs text-right font-semibold tabular-nums">{row.total}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
              <p className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border">
                Stage counts come from the Sign Up → Ready to Go board's Install Phase field. Finland is excluded, matching how the rest of this dashboard treats it (no further pipeline activity).
              </p>
            </div>

            <div className="border border-border rounded-md bg-[hsl(var(--surface-1))]">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Scheduled vs Actual by Country</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[hsl(var(--surface-2))] border-b border-border">
                    <tr>
                      <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Country</th>
                      {scheduledByMonth.map((m) => (
                        <th key={m.ym} className="px-5 py-2.5 text-center text-xs font-medium text-muted-foreground border-l border-border">
                          {m.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {SCHEDULE_TABLE_COUNTRIES.map((c) => (
                      <tr key={c} className="hover:bg-[hsl(var(--surface-2))] transition-colors">
                        <td className="px-5 py-3 text-xs font-medium">{FLAGS[c]} {c}</td>
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
                            <td key={m.ym} className="px-5 py-2.5 text-center border-l border-border">
                              <div className="text-sm font-semibold tabular-nums" style={{ color: pctColor }}>
                                {pct === null ? '\u2014' : `${pct}%`}
                              </div>
                              <div className="text-[10px] text-muted-foreground tabular-nums">{actual} / {sched}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border">
                Each cell shows the hit rate (Actual {'\u00f7'} Scheduled) with the raw numbers underneath.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
