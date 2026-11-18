import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Activity, BarChart3, Boxes, ChartNoAxesCombined, Layers3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import type { ReconciliationResult, Scalar } from '../core/types.js';

type Trace = Record<string, unknown>;
interface PlotlyApi {
  newPlot(target: HTMLElement, data: Trace[], layout: Record<string, unknown>, config: Record<string, unknown>): Promise<unknown>;
  purge(target: HTMLElement): void;
  Plots: { resize(target: HTMLElement): void };
}
declare global { interface Window { Plotly?: PlotlyApi } }

interface AnalyticsReportProps { result: ReconciliationResult }
interface ChartModel { title: string; method: string; description: string; data: Trace[]; layout?: Record<string, unknown>; empty?: string }
interface ProfileRow { source: 'A' | 'B'; row: Record<string, Scalar> }

const fmt = (value: number): string => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const numeric = (value: Scalar): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const text = (value: Scalar): string => value === null ? '(null)' : String(value);
const fieldName = (item: ReconciliationResult['mismatches'][number]): string =>
  item.leftField === item.rightField ? item.leftField : `${item.leftField} → ${item.rightField}`;

function buildAnalytics(result: ReconciliationResult): { charts: ChartModel[]; mismatchCount: number; fieldCount: number; numericCount: number; profileCount: number } {
  const fieldCounts = new Map<string, number>();
  const numericPairs: Array<{ left: number; right: number; delta: number; field: string }> = [];
  const transitions = new Map<string, number>();
  for (const item of result.mismatches) {
    const field = fieldName(item);
    fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    const left = numeric(item.leftValue);
    const right = numeric(item.rightValue);
    if (left !== null && right !== null) numericPairs.push({ left, right, delta: Math.abs(left - right), field });
    else {
      const label = `${text(item.leftValue)} → ${text(item.rightValue)}`;
      transitions.set(label, (transitions.get(label) ?? 0) + 1);
    }
  }

  const profileRows: ProfileRow[] = [
    ...result.missing.onlyOnLeft.map((row) => ({ source: 'A' as const, row })),
    ...result.missing.onlyOnRight.map((row) => ({ source: 'B' as const, row })),
    ...result.duplicates.left.flatMap((group) => group.records.map((row) => ({ source: 'A' as const, row }))),
    ...result.duplicates.right.flatMap((group) => group.records.map((row) => ({ source: 'B' as const, row }))),
  ];
  const columns = [...new Set(profileRows.flatMap(({ row }) => Object.keys(row)))];
  const numericFields = columns.map((field) => ({
    field,
    values: profileRows.map(({ row }) => numeric(row[field] ?? null)),
  })).filter(({ values }) => values.filter((value) => value !== null).length >= 3);
  const qualityLabels = ['Missing records', 'Duplicate groups', 'Schema-only fields'];
  const qualityA = [result.missing.onlyOnRight.length, result.duplicates.left.length, result.schema.onlyOnLeft.length];
  const qualityB = [result.missing.onlyOnLeft.length, result.duplicates.right.length, result.schema.onlyOnRight.length];

  const ranked = [...fieldCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  let running = 0;
  const cumulative = ranked.map(([, count]) => {
    running += count;
    return result.mismatches.length ? running / result.mismatches.length * 100 : 0;
  });
  const transitionTop = [...transitions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const charts: ChartModel[] = [
    {
      title: result.mismatches.length ? 'Mismatch impact' : 'Structural quality',
      method: result.mismatches.length ? 'Pareto analysis' : 'Source comparison',
      description: result.mismatches.length ? 'Fields ranked by contribution; line shows cumulative share.' : 'Missing records, duplicate groups and schema-only fields by source.',
      data: result.mismatches.length ? [
        { type: 'bar', name: 'Differences', x: ranked.map(([field]) => field), y: ranked.map(([, count]) => count), hovertemplate: '%{x}<br>%{y} differences<extra></extra>' },
        { type: 'scatter', name: 'Cumulative share', x: ranked.map(([field]) => field), y: cumulative, yaxis: 'y2', mode: 'lines+markers', hovertemplate: '%{y:.1f}%<extra></extra>' },
      ] : [
        { type: 'bar', name: 'Source A', x: qualityLabels, y: qualityA },
        { type: 'bar', name: 'Source B', x: qualityLabels, y: qualityB },
      ],
      layout: result.mismatches.length ? { yaxis2: { title: 'Cumulative %', overlaying: 'y', side: 'right', range: [0, 105], ticksuffix: '%' }, legend: { orientation: 'h' } } : { barmode: 'group', legend: { orientation: 'h' } },
      empty: 'No mismatches or structural differences were found.',
    },
    {
      title: numericPairs.length ? 'Numeric difference distribution' : transitionTop.length ? 'Categorical transitions' : 'Numeric field profile',
      method: numericPairs.length ? 'Histogram' : transitionTop.length ? 'Frequency distribution' : 'Adaptive field profiling',
      description: numericPairs.length ? 'Absolute A/B deltas for numeric mismatches.' : transitionTop.length ? 'Most frequent non-numeric value transitions.' : 'Distribution of available numeric values in missing and duplicate records.',
      data: numericPairs.length ? [
        { type: 'histogram', name: 'Absolute delta', x: numericPairs.map((pair) => pair.delta), nbinsx: 24, opacity: 0.82 },
      ] : transitionTop.length ? [
        { type: 'bar', x: transitionTop.map(([label]) => label), y: transitionTop.map(([, count]) => count) },
      ] : numericFields.length ? [
        ...(['A', 'B'] as const).map((source) => ({
          type: 'histogram', name: `Source ${source}`,
          x: profileRows.filter((entry) => entry.source === source).map(({ row }) => numeric(row[numericFields[0]?.field ?? ''] ?? null)).filter((value): value is number => value !== null),
          opacity: 0.65,
        })),
      ] : [],
      layout: { barmode: 'overlay', xaxis: { title: numericPairs.length ? 'Absolute difference' : 'Value transition' }, yaxis: { title: 'Frequency' }, legend: { orientation: 'h' } },
      empty: 'There are not enough numeric or categorical observations to estimate a distribution.',
    },
    {
      title: numericPairs.length >= 2 ? 'Source value relationship' : 'Mismatch composition',
      method: numericPairs.length >= 5 && new Set(numericPairs.map((pair) => pair.delta)).size > 1 ? '3D scatter · A / B / absolute delta' : numericPairs.length >= 2 ? '2D scatter · A vs B' : 'Categorical frequency',
      description: numericPairs.length >= 2 ? 'Each point is an actual numeric mismatch; the diagonal represents equality.' : 'Observed non-numeric value transitions, not generated sample data.',
      data: numericPairs.length >= 5 && new Set(numericPairs.map((pair) => pair.delta)).size > 1 ? [
        { type: 'scatter3d', mode: 'markers', x: numericPairs.map((pair) => pair.left), y: numericPairs.map((pair) => pair.right), z: numericPairs.map((pair) => pair.delta), text: numericPairs.map((pair) => pair.field), marker: { size: 4, opacity: 0.8, color: numericPairs.map((pair) => pair.delta), colorscale: 'Viridis' }, hovertemplate: 'A: %{x}<br>B: %{y}<br>|Δ|: %{z}<br>%{text}<extra></extra>' },
      ] : numericPairs.length >= 2 ? [
        { type: 'scatter', mode: 'markers', x: numericPairs.map((pair) => pair.left), y: numericPairs.map((pair) => pair.right), text: numericPairs.map((pair) => pair.field), hovertemplate: 'A: %{x}<br>B: %{y}<br>%{text}<extra></extra>' },
        { type: 'scatter', mode: 'lines', x: numericPairs.length ? [Math.min(...numericPairs.map((pair) => pair.left)), Math.max(...numericPairs.map((pair) => pair.left))] : [], y: numericPairs.length ? [Math.min(...numericPairs.map((pair) => pair.left)), Math.max(...numericPairs.map((pair) => pair.left))] : [], name: 'Equality line', hoverinfo: 'skip' },
      ] : transitionTop.length ? [
        { type: 'bar', x: transitionTop.map(([label]) => label), y: transitionTop.map(([, count]) => count) },
      ] : [],
      layout: numericPairs.length >= 5 && new Set(numericPairs.map((pair) => pair.delta)).size > 1
        ? { scene: { xaxis: { title: 'Source A' }, yaxis: { title: 'Source B' }, zaxis: { title: 'Absolute delta' } } }
        : { xaxis: { title: 'Source A' }, yaxis: { title: 'Source B' } },
      empty: 'No numeric pairs or categorical transitions are available for this comparison.',
    },
    {
      title: numericFields.length >= 3 ? 'Multivariate record profile' : 'Data quality by source',
      method: numericFields.length >= 3 && profileRows.length >= 3 ? '3D multivariate scatter' : numericFields.length >= 2 && profileRows.length >= 3 ? '2D numeric relationship' : 'Grouped quality metrics',
      description: numericFields.length >= 2 && profileRows.length >= 3 ? 'Uses observed numeric columns from missing and duplicate records only.' : 'Shows the structural differences that remain meaningful for any schema.',
      data: numericFields.length >= 3 && profileRows.length >= 3 ? [
        { type: 'scatter3d', mode: 'markers', x: numericFields[0]?.values.map((value) => value ?? null), y: numericFields[1]?.values.map((value) => value ?? null), z: numericFields[2]?.values.map((value) => value ?? null), text: profileRows.map(({ source }) => `Source ${source}`), marker: { size: 4, opacity: 0.75 }, hovertemplate: 'X: %{x}<br>Y: %{y}<br>Z: %{z}<br>%{text}<extra></extra>' },
      ] : numericFields.length >= 2 && profileRows.length >= 3 ? [
        { type: 'scatter', mode: 'markers', x: numericFields[0]?.values.map((value) => value ?? null), y: numericFields[1]?.values.map((value) => value ?? null), text: profileRows.map(({ source }) => `Source ${source}`), hovertemplate: '%{text}<br>X: %{x}<br>Y: %{y}<extra></extra>' },
      ] : [
        { type: 'bar', name: 'Source A', x: qualityLabels, y: qualityA },
        { type: 'bar', name: 'Source B', x: qualityLabels, y: qualityB },
      ],
      layout: { barmode: 'group', scene: { xaxis: { title: numericFields[0]?.field ?? 'X' }, yaxis: { title: numericFields[1]?.field ?? 'Y' }, zaxis: { title: numericFields[2]?.field ?? 'Z' } } },
      empty: 'No structural differences or multivariate observations are available.',
    },
  ];

  return {
    charts,
    mismatchCount: result.mismatches.length,
    fieldCount: fieldCounts.size,
    numericCount: numericPairs.length,
    profileCount: profileRows.length,
  };
}

export function AnalyticsReport({ result }: AnalyticsReportProps): ReactElement {
  const [plotlyReady, setPlotlyReady] = useState(Boolean(window.Plotly));
  const nodes = useRef<Array<HTMLDivElement | null>>([]);
  const analysis = useMemo(() => buildAnalytics(result), [result]);

  useEffect(() => {
    if (window.Plotly) { setPlotlyReady(true); return; }
    const script = document.querySelector<HTMLScriptElement>('script[src^="https://cdn.plot.ly/"]');
    const onLoad = (): void => setPlotlyReady(Boolean(window.Plotly));
    script?.addEventListener('load', onLoad);
    return () => script?.removeEventListener('load', onLoad);
  }, []);

  useEffect(() => {
    const plotly = window.Plotly;
    if (!plotlyReady || !plotly) return;
    const targets = nodes.current.filter((node): node is HTMLDivElement => Boolean(node));
    const theme = document.querySelector('.theme-root') ?? document.documentElement;
    const color = getComputedStyle(theme).color || '#64748b';
    const grid = getComputedStyle(theme).getPropertyValue('--border').trim() || 'rgba(148,163,184,.25)';
    const common = { autosize: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { family: 'Inter, sans-serif', color, size: 11 }, margin: { l: 48, r: 24, t: 24, b: 64 }, colorway: ['#6366f1', '#06b6d4', '#f59e0b', '#ec4899'] };
    const config = { responsive: true, displaylogo: false, displayModeBar: true };
    const tasks = analysis.charts.map((chart, index) => {
      const target = targets[index];
      if (!target || chart.data.length === 0) return Promise.resolve();
      return plotly.newPlot(target, chart.data, { ...common, xaxis: { automargin: true, gridcolor: grid }, yaxis: { automargin: true, gridcolor: grid }, ...chart.layout }, config);
    });
    const observer = new ResizeObserver(() => targets.forEach((target) => plotly.Plots.resize(target)));
    targets.forEach((target) => observer.observe(target));
    return () => { observer.disconnect(); targets.forEach((target) => plotly.purge(target)); };
  }, [analysis, plotlyReady]);

  const qualityTotal = result.missing.onlyOnLeft.length + result.missing.onlyOnRight.length
    + result.duplicates.left.length + result.duplicates.right.length
    + result.schema.onlyOnLeft.length + result.schema.onlyOnRight.length;
  return (
    <section className="analytics-report" aria-label="Adaptive statistical analytics report">
      <div className="analytics-report-header">
        <div>
          <div className="analytics-eyebrow"><Activity size={14} /> ADAPTIVE STATISTICAL ANALYTICS</div>
          <h2>Data intelligence report</h2>
          <p>Methods are selected from the actual shape and quality of the comparison result.</p>
        </div>
        <Badge variant="outline">OBSERVED DATA ONLY</Badge>
      </div>
      <div className="analytics-kpi-grid">
        <Card className="analytics-kpi"><CardContent><span><ChartNoAxesCombined size={15} /> Value mismatches</span><strong>{fmt(analysis.mismatchCount)}</strong></CardContent></Card>
        <Card className="analytics-kpi"><CardContent><span><Layers3 size={15} /> Affected fields</span><strong>{fmt(analysis.fieldCount)}</strong></CardContent></Card>
        <Card className="analytics-kpi"><CardContent><span><Boxes size={15} /> Structural issues</span><strong>{fmt(qualityTotal)}</strong></CardContent></Card>
        <Card className="analytics-kpi"><CardContent><span><BarChart3 size={15} /> Numeric pairs / profile rows</span><strong>{fmt(analysis.numericCount)} / {fmt(analysis.profileCount)}</strong></CardContent></Card>
      </div>
      {!plotlyReady && <div className="analytics-unavailable" role="status">Plotly.js could not be loaded. Check CDN access and reload the report.</div>}
      <div className="analytics-chart-grid">
        {analysis.charts.map((chart, index) => (
          <Card className="analytics-chart-card" key={chart.title}>
            <CardHeader>
              <div className="analytics-chart-title"><Badge>{chart.method}</Badge><CardTitle>{chart.title}</CardTitle></div>
              <CardDescription>{chart.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {chart.data.length > 0
                ? <div ref={(node) => { nodes.current[index] = node; }} className={chart.method.includes('3D') || chart.method.includes('3d') ? 'analytics-plot analytics-plot-3d' : 'analytics-plot analytics-plot-2d'} role="img" aria-label={chart.title} />
                : <div className="analytics-chart-empty">{chart.empty}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="analytics-footnote">3D is used only when at least five numeric mismatch pairs or three numeric record fields provide real dimensions. Otherwise the report falls back to 2D, categorical frequency, Pareto or structural quality analysis. No synthetic records or inferred time axis are created.</p>
    </section>
  );
}
