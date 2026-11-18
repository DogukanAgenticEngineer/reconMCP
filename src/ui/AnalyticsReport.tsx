import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { animate, stagger } from 'animejs';
import { Activity, BarChart3, Boxes, ChartNoAxesCombined, Layers3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import type { ReconciliationResult } from '../core/types.js';

type PlotTrace = Record<string, unknown>;
interface PlotlyApi {
  newPlot(target: HTMLElement, data: PlotTrace[], layout: Record<string, unknown>, config: Record<string, unknown>): Promise<unknown>;
  purge(target: HTMLElement): void;
  Plots: { resize(target: HTMLElement): void };
}
declare global {
  interface Window { Plotly?: PlotlyApi }
}

interface AnalyticsReportProps { result: ReconciliationResult }

const number = (value: number): string => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const compactKey = (value: string): string => value.length > 42 ? `${value.slice(0, 39)}…` : value;
const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' };
const escapeHtml = (value: string): string => value.replace(/[&<>\"']/g, (character) => HTML_ENTITIES[character] ?? character);

export function AnalyticsReport({ result }: AnalyticsReportProps): ReactElement {
  const [plotlyReady, setPlotlyReady] = useState(Boolean(window.Plotly));
  const scatterRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const paretoRef = useRef<HTMLDivElement>(null);
  const divergingRef = useRef<HTMLDivElement>(null);
  const plotRefs = useMemo(() => [scatterRef, surfaceRef, paretoRef, divergingRef], []);

  useEffect(() => {
    if (window.Plotly) { setPlotlyReady(true); return; }
    const script = document.querySelector<HTMLScriptElement>('script[src^="https://cdn.plot.ly/"]');
    const onLoad = (): void => setPlotlyReady(Boolean(window.Plotly));
    script?.addEventListener('load', onLoad);
    return () => script?.removeEventListener('load', onLoad);
  }, []);

  const analysis = useMemo(() => {
    const fieldCounts = new Map<string, number>();
    const keyIndexes = new Map<string, number>();
    const scatterX: number[] = [];
    const scatterY: number[] = [];
    const scatterZ: number[] = [];
    const scatterText: string[] = [];
    const surfaceFields = new Map<string, number>();
    const bucketCount = 20;
    const surface = new Map<string, number[]>();

    result.mismatches.forEach((item, index) => {
      const field = item.leftField === item.rightField ? item.leftField : `${item.leftField} → ${item.rightField}`;
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
      if (!surfaceFields.has(field) && surfaceFields.size < 14) surfaceFields.set(field, surfaceFields.size);
      const key = JSON.stringify(item.key);
      if (!keyIndexes.has(key)) keyIndexes.set(key, keyIndexes.size);
      const rowIndex = keyIndexes.get(key) ?? 0;
      const bucket = Math.min(bucketCount - 1, Math.floor((rowIndex / Math.max(1, result.summary.matchedKeys + result.summary.mismatchedRows)) * bucketCount));
      const values = surface.get(field) ?? Array.from({ length: bucketCount }, () => 0);
      values[bucket] += 1;
      surface.set(field, values);

      const leftNumber = typeof item.leftValue === 'number' ? item.leftValue : Number.NaN;
      const rightNumber = typeof item.rightValue === 'number' ? item.rightValue : Number.NaN;
      const delta = Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
        ? Math.min(Math.abs(leftNumber - rightNumber), 1_000_000)
        : 1;
      // Keep the interactive point cloud bounded even for wide, high-volume comparisons.
      if (index % Math.max(1, Math.ceil(result.mismatches.length / 1800)) === 0) {
        scatterX.push(surfaceFields.get(field) ?? Math.min(surfaceFields.size, 13));
        scatterY.push(rowIndex);
        scatterZ.push(delta);
        scatterText.push(`Key: ${escapeHtml(compactKey(key))}<br>Field: ${escapeHtml(field)}<br>A: ${escapeHtml(String(item.leftValue ?? '—'))}<br>B: ${escapeHtml(String(item.rightValue ?? '—'))}`);
      }
    });

    const pareto = [...fieldCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
    const paretoTotal = [...fieldCounts.values()].reduce((sum, value) => sum + value, 0);
    let cumulative = 0;
    const cumulativePercent = pareto.map(([, count]) => {
      cumulative += count;
      return paretoTotal === 0 ? 0 : (cumulative / paretoTotal) * 100;
    });
    const surfaceLabels = [...surfaceFields.keys()];
    const z = surfaceLabels.map((field) => surface.get(field) ?? Array.from({ length: bucketCount }, () => 0));
    const segmentLabels = Array.from({ length: bucketCount }, (_, index) => `Segment ${index + 1}`);

    return {
      fieldCounts,
      scatterX,
      scatterY,
      scatterZ,
      scatterText,
      surfaceLabels,
      segmentLabels,
      surfaceZ: z,
      paretoLabels: pareto.map(([field]) => field),
      paretoValues: pareto.map(([, count]) => count),
      cumulativePercent,
      sourceA: [result.missing.onlyOnLeft.length, result.duplicates.left.length],
      sourceB: [result.missing.onlyOnRight.length, result.duplicates.right.length],
      mismatchFields: fieldCounts.size,
      totalMismatches: result.mismatches.length,
    };
  }, [result]);

  useEffect(() => {
    const nodes = plotRefs.map((ref) => ref.current).filter((node): node is HTMLDivElement => Boolean(node));
    const plotly = window.Plotly;
    if (!plotlyReady || !plotly || nodes.length !== 4) return;
    const fontColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim()
      ? getComputedStyle(document.querySelector('.theme-root') ?? document.documentElement).color
      : '#64748b';
    const gridColor = getComputedStyle(document.querySelector('.theme-root') ?? document.documentElement).getPropertyValue('--border').trim();
    const commonLayout = {
      autosize: true,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Geist Variable, Inter, sans-serif', color: fontColor, size: 11 },
      margin: { l: 48, r: 24, t: 24, b: 56 },
      colorway: ['#6366f1', '#06b6d4', '#f59e0b', '#ec4899', '#10b981'],
    };
    const config = { responsive: true, displaylogo: false, displayModeBar: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'] };
    const plots = [
      plotly.newPlot(nodes[0], [{
        type: 'scatter3d', mode: 'markers', x: analysis.scatterX, y: analysis.scatterY, z: analysis.scatterZ,
        text: analysis.scatterText, hovertemplate: '%{text}<extra></extra>',
        marker: { size: 3.5, opacity: 0.82, color: analysis.scatterZ, colorscale: 'Viridis', showscale: true, colorbar: { title: 'Δ / type' } },
      }], {
        ...commonLayout, scene: {
          xaxis: { title: 'Field index', gridcolor: gridColor }, yaxis: { title: 'Record index', gridcolor: gridColor },
          zaxis: { title: 'Difference magnitude', gridcolor: gridColor }, camera: { eye: { x: 1.55, y: 1.55, z: 1.05 } },
        },
      }, config),
      plotly.newPlot(nodes[1], [{
        type: 'surface', x: analysis.segmentLabels.map((_, index) => index + 1), y: analysis.surfaceLabels.map((_, index) => index + 1), z: analysis.surfaceZ,
        colorscale: 'Portland', showscale: true, hovertemplate: 'Field index: %{y}<br>Segment: %{x}<br>Mismatch count: %{z}<extra></extra>',
      }], {
        ...commonLayout, margin: { l: 8, r: 8, t: 20, b: 8 },
        scene: {
          xaxis: { title: 'Record segments', tickmode: 'array', tickvals: analysis.segmentLabels.map((_, index) => index + 1), ticktext: analysis.segmentLabels, gridcolor: gridColor }, yaxis: { title: 'Fields', tickmode: 'array', tickvals: analysis.surfaceLabels.map((_, index) => index + 1), ticktext: analysis.surfaceLabels, gridcolor: gridColor },
          zaxis: { title: 'Mismatch count', gridcolor: gridColor }, camera: { eye: { x: 1.55, y: 1.55, z: 1.05 } },
        },
      }, config),
      plotly.newPlot(nodes[2], [
        { type: 'bar', name: 'Mismatch count', x: analysis.paretoLabels, y: analysis.paretoValues, marker: { color: '#6366f1' }, hovertemplate: '%{x}<br>%{y} mismatches<extra></extra>' },
        { type: 'scatter', name: 'Cumulative impact', x: analysis.paretoLabels, y: analysis.cumulativePercent, yaxis: 'y2', mode: 'lines+markers', line: { color: '#f59e0b', width: 3 }, hovertemplate: '%{x}<br>%{y:.1f}% cumulative<extra></extra>' },
      ], {
        ...commonLayout, barmode: 'group', margin: { l: 48, r: 52, t: 24, b: 100 },
        xaxis: { tickangle: -28, automargin: true, gridcolor: gridColor },
        yaxis: { title: 'Mismatches', rangemode: 'tozero', gridcolor: gridColor },
        yaxis2: { title: 'Cumulative %', overlaying: 'y', side: 'right', range: [0, 105], ticksuffix: '%' },
        legend: { orientation: 'h', y: 1.16 },
      }, config),
      plotly.newPlot(nodes[3], [
        { type: 'bar', name: 'Source A', orientation: 'h', y: ['Missing records', 'Duplicate keys'], x: analysis.sourceA, marker: { color: '#06b6d4' }, hovertemplate: '%{y}<br>Source A: %{x}<extra></extra>' },
        { type: 'bar', name: 'Source B', orientation: 'h', y: ['Missing records', 'Duplicate keys'], x: analysis.sourceB.map((value) => -value), marker: { color: '#f59e0b' }, hovertemplate: '%{y}<br>Source B: %{customdata}<extra></extra>', customdata: analysis.sourceB },
      ], {
        ...commonLayout, barmode: 'relative', margin: { l: 115, r: 24, t: 24, b: 48 },
        xaxis: { title: 'A ← count → B', zeroline: true, zerolinewidth: 2, gridcolor: gridColor, tickformat: ',d' },
        yaxis: { automargin: true },
        legend: { orientation: 'h', y: 1.16 },
      }, config),
    ];
    let active = true;
    void Promise.all(plots).then(() => {
      if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      nodes.forEach((node, index) => {
        const motion = animate(node, { opacity: [0.35, 1], y: [12, 0], duration: 720, delay: index * 90, ease: 'outExpo' });
        void motion;
      });
    });
    const observer = new ResizeObserver(() => nodes.forEach((node) => plotly.Plots.resize(node)));
    nodes.forEach((node) => observer.observe(node));
    return () => {
      active = false;
      observer.disconnect();
      nodes.forEach((node) => plotly.purge(node));
    };
  }, [analysis, plotRefs, plotlyReady]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const motion = animate('.analytics-report-header', { opacity: [0, 1], y: [14, 0], duration: 650, ease: 'outExpo' });
    const cards = animate('.analytics-chart-card', { opacity: [0, 1], y: [20, 0], delay: stagger(85), duration: 700, ease: 'outExpo' });
    return () => { motion.pause(); cards.pause(); };
  }, [result]);

  const plotlyAvailable = plotlyReady;
  const noMismatchData = analysis.totalMismatches === 0;
  return (
    <section className="analytics-report" aria-label="Advanced data analytics report">
      <div className="analytics-report-header">
        <div>
          <div className="analytics-eyebrow"><Activity size={14} /> RECONCILIATION INTELLIGENCE</div>
          <h2>Advanced analytics report</h2>
          <p>Four complementary views built from the complete reconciliation result.</p>
        </div>
        <Badge variant="outline">LIVE RESULT · NO SYNTHETIC DATA</Badge>
      </div>
      <div className="analytics-kpi-grid">
        <Card className="analytics-kpi"><CardContent><span><ChartNoAxesCombined size={15} /> Value mismatches</span><strong>{number(analysis.totalMismatches)}</strong></CardContent></Card>
        <Card className="analytics-kpi"><CardContent><span><Layers3 size={15} /> Affected fields</span><strong>{number(analysis.mismatchFields)}</strong></CardContent></Card>
        <Card className="analytics-kpi"><CardContent><span><Boxes size={15} /> Missing records</span><strong>{number(result.missing.onlyOnLeft.length + result.missing.onlyOnRight.length)}</strong></CardContent></Card>
        <Card className="analytics-kpi"><CardContent><span><BarChart3 size={15} /> Duplicate groups</span><strong>{number(result.duplicates.left.length + result.duplicates.right.length)}</strong></CardContent></Card>
      </div>
      {!plotlyAvailable && <div className="analytics-unavailable" role="status">Plotly.js CDN could not be loaded. Check your connection or CDN access and reload the report.</div>}
      {noMismatchData && <div className="analytics-unavailable" role="status">No value mismatches were found. The mismatch-based 3D and Pareto views will remain empty; missing-record and duplicate counts are still shown in the KPIs.</div>}
      <div className="analytics-chart-grid">
        <Card className="analytics-chart-card">
          <CardHeader><div className="analytics-chart-title"><Badge>3D · 01</Badge><CardTitle>Mismatch topology</CardTitle></div><CardDescription>3D scatter · record index × field × numeric delta / mismatch marker</CardDescription></CardHeader>
          <CardContent><div ref={scatterRef} className="analytics-plot" role="img" aria-label="Three-dimensional scatter plot of mismatch records and fields" /></CardContent>
        </Card>
        <Card className="analytics-chart-card">
          <CardHeader><div className="analytics-chart-title"><Badge>3D · 02</Badge><CardTitle>Mismatch density surface</CardTitle></div><CardDescription>3D surface · mismatch counts across record segments and fields</CardDescription></CardHeader>
          <CardContent><div ref={surfaceRef} className="analytics-plot" role="img" aria-label="Three-dimensional surface of mismatch density by field and record segment" /></CardContent>
        </Card>
        <Card className="analytics-chart-card">
          <CardHeader><div className="analytics-chart-title"><Badge>2D · 03</Badge><CardTitle>Pareto impact analysis</CardTitle></div><CardDescription>Ranked mismatch fields with cumulative contribution</CardDescription></CardHeader>
          <CardContent><div ref={paretoRef} className="analytics-plot analytics-plot-2d" role="img" aria-label="Pareto chart of mismatch fields and cumulative impact" /></CardContent>
        </Card>
        <Card className="analytics-chart-card">
          <CardHeader><div className="analytics-chart-title"><Badge>2D · 04</Badge><CardTitle>Source imbalance</CardTitle></div><CardDescription>Diverging bars · records and duplicate groups by source</CardDescription></CardHeader>
          <CardContent><div ref={divergingRef} className="analytics-plot analytics-plot-2d" role="img" aria-label="Diverging bar chart comparing missing records and duplicate groups across sources" /></CardContent>
        </Card>
      </div>
      <p className="analytics-footnote">3D scatter is capped at 1,800 plotted points for browser responsiveness. The density surface and Pareto totals are aggregated from all returned mismatch details. Numeric deltas are absolute; non-numeric mismatches use a neutral marker value of 1. Missing-record and duplicate counts are shown independently for A and B.</p>
    </section>
  );
}
