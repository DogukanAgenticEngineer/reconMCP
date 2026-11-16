import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Progress } from '@/components/ui/progress.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import type { ComparisonPreviewRow, ComparisonStatus, ReconciliationResult, Scalar } from '../core/types.js';
import { displayScalar, filteredPreview, matchedRate, shorten, type PreviewStatusFilter } from './dashboard-logic.js';

interface ResultsPanelProps {
  result: ReconciliationResult | null;
  tab: string;
  onTabChange: (value: string) => void;
  onlyDifferences: boolean;
}

const STATUS: Record<ComparisonStatus, { label: string; className: string }> = {
  match: { label: 'Match', className: 'status-match' },
  mismatch: { label: 'Mismatch', className: 'status-mismatch' },
  only_left: { label: 'Only in A', className: 'status-left' },
  only_right: { label: 'Only in B', className: 'status-right' },
  duplicate: { label: 'Duplicate', className: 'status-duplicate' },
};

interface DifferenceRow {
  id: string;
  status: ComparisonStatus | 'schema';
  key: string;
  field: string;
  left: string;
  right: string;
}

function keyText(value: string): string {
  return shorten(value, 160);
}

function searchableDifferences(result: ReconciliationResult): DifferenceRow[] {
  const rows: DifferenceRow[] = [
    ...result.mismatches.map((item, index) => ({
      id: `mismatch-${index}`,
      status: 'mismatch' as const,
      key: JSON.stringify(item.key),
      field: item.leftField === item.rightField ? item.leftField : `${item.leftField} → ${item.rightField}`,
      left: displayScalar(item.leftValue),
      right: displayScalar(item.rightValue),
    })),
    ...result.missing.onlyOnLeft.map((item, index) => ({
      id: `missing-a-${index}`,
      status: 'only_left' as const,
      key: shorten(JSON.stringify(item), 240),
      field: 'Record',
      left: shorten(JSON.stringify(item), 180),
      right: '—',
    })),
    ...result.missing.onlyOnRight.map((item, index) => ({
      id: `missing-b-${index}`,
      status: 'only_right' as const,
      key: shorten(JSON.stringify(item), 240),
      field: 'Record',
      left: '—',
      right: shorten(JSON.stringify(item), 180),
    })),
    ...result.duplicates.left.map((group, index) => ({
      id: `duplicate-a-${index}`,
      status: 'duplicate' as const,
      key: JSON.stringify(group.key),
      field: 'Duplicate key',
      left: `${group.count} rows`,
      right: '—',
    })),
    ...result.duplicates.right.map((group, index) => ({
      id: `duplicate-b-${index}`,
      status: 'duplicate' as const,
      key: JSON.stringify(group.key),
      field: 'Duplicate key',
      left: '—',
      right: `${group.count} rows`,
    })),
    ...result.schema.onlyOnLeft.map((field, index) => ({
      id: `schema-a-${index}`,
      status: 'schema' as const,
      key: field,
      field: 'Schema field',
      left: 'Present',
      right: '—',
    })),
    ...result.schema.onlyOnRight.map((field, index) => ({
      id: `schema-b-${index}`,
      status: 'schema' as const,
      key: field,
      field: 'Schema field',
      left: '—',
      right: 'Present',
    })),
  ];
  return rows;
}

function ValueCell({ value }: { value: Scalar | string }): ReactElement {
  const text = typeof value === 'string' ? value : displayScalar(value);
  return <span className="cell-ellipsis" title={text}>{shorten(text, 180)}</span>;
}

function EmptyState({ children }: { children: string }): ReactElement {
  return <div className="empty-state"><p>{children}</p></div>;
}

function ComparisonTable({ rows, previewTruncated, onlyDifferences }: { rows: ComparisonPreviewRow[]; previewTruncated: boolean; onlyDifferences: boolean }): ReactElement {
  if (rows.length === 0) return <EmptyState>{onlyDifferences ? 'No differences found. Turn off the filter to show matching records.' : 'No key groups match these filters.'}</EmptyState>;
  return (
    <>
      {previewTruncated && <p className="table-note">Showing up to 50 key groups. The downloaded CSV report contains all differences.</p>}
      <div className="table-wrap">
        <Table aria-label="Comparison preview">
          <TableHeader><TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="numeric-cell">Rows A</TableHead>
            <TableHead className="numeric-cell">Rows B</TableHead>
            <TableHead className="numeric-cell">Different fields</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const status = STATUS[row.status];
              return <TableRow key={`${row.key}-${index}`}>
                <TableCell><span className="cell-ellipsis" title={row.key}>{keyText(row.key)}</span></TableCell>
                <TableCell><Badge variant="outline" className={`status-badge ${status.className}`}>{status.label}</Badge></TableCell>
                <TableCell className="numeric-cell">{row.leftRows.toLocaleString()}</TableCell>
                <TableCell className="numeric-cell">{row.rightRows.toLocaleString()}</TableCell>
                <TableCell className="numeric-cell">{row.mismatchFields || '—'}</TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function DifferenceTable({ rows, truncated }: { rows: DifferenceRow[]; truncated: boolean }): ReactElement {
  if (rows.length === 0) return <EmptyState>No differences match this search.</EmptyState>;
  return (
    <>
      {truncated && <p className="table-note">Showing the first 100 matching details. Download CSV for the complete report.</p>}
      <div className="table-wrap">
        <Table aria-label="Difference details">
          <TableHeader><TableRow>
            <TableHead>Key / record</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Source A</TableHead>
            <TableHead>Source B</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((row) => {
              const status = row.status === 'schema' ? { label: 'Schema', className: 'status-schema' } : STATUS[row.status];
              return <TableRow key={row.id}>
                <TableCell><span className="cell-ellipsis" title={row.key}>{keyText(row.key)}</span></TableCell>
                <TableCell><Badge variant="outline" className={`status-badge ${status.className}`}>{status.label}</Badge></TableCell>
                <TableCell><ValueCell value={row.field} /></TableCell>
                <TableCell><ValueCell value={row.left} /></TableCell>
                <TableCell><ValueCell value={row.right} /></TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function Summary({ result }: { result: ReconciliationResult }): ReactElement {
  const { summary } = result;
  const metrics = [
    { label: 'Exact matches', value: summary.matchedRows, tone: 'good' },
    { label: 'Common unique keys', value: summary.matchedKeys, tone: 'neutral' },
    { label: 'Rows with differences', value: summary.mismatchedRows, tone: 'bad' },
    { label: 'Only in A', value: summary.missingOnRight, tone: 'warn' },
    { label: 'Only in B', value: summary.missingOnLeft, tone: 'warn' },
    { label: 'Duplicate keys', value: summary.duplicateKeysOnLeft + summary.duplicateKeysOnRight, tone: 'bad' },
    { label: 'Schema differences', value: summary.schemaIssues, tone: 'neutral' },
  ];
  const rate = matchedRate(result);
  return (
    <div className="summary-content">
      <div className="metric-grid">
        {metrics.map((metric, index) => <Card key={metric.label} className={`metric-card metric-${metric.tone}`} style={{ animationDelay: `${index * 45}ms` }}>
          <CardHeader className="metric-header"><CardDescription>{metric.label}</CardDescription></CardHeader>
          <CardContent className="metric-content"><div className="metric-value">{metric.value.toLocaleString()}</div></CardContent>
        </Card>)}
      </div>
      <Card className="rate-card">
        <CardHeader className="rate-header">
          <CardTitle>Exact match rate</CardTitle>
          <CardDescription>Among shared unique keys, excluding duplicate keys</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rate-line"><strong>{summary.matchedKeys === 0 ? '—' : `${rate.toFixed(1)}%`}</strong><span>{summary.matchedRows.toLocaleString()} of {summary.matchedKeys.toLocaleString()} unique key groups</span></div>
          <Progress className="match-progress" value={rate} aria-label="Exact match rate among shared unique keys" />
        </CardContent>
      </Card>
      <div className="source-count-line">
        <span>{summary.leftSource}: {summary.leftRows.toLocaleString()} rows</span>
        <span>{summary.rightSource}: {summary.rightRows.toLocaleString()} rows</span>
      </div>
    </div>
  );
}

export function ResultsPanel({ result, tab, onTabChange, onlyDifferences }: ResultsPanelProps): ReactElement {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PreviewStatusFilter>('all');
  useEffect(() => { setQuery(''); setStatus('all'); }, [result]);
  const previewSearchText = useMemo(() => {
    const index = new Map<string, string>();
    if (!result) return index;
    const visibleKeys = new Set(result.comparisonPreview.map((row) => row.key));
    for (const mismatch of result.mismatches) {
      const fullKey = JSON.stringify(mismatch.key);
      const key = shorten(fullKey, 240);
      if (!visibleKeys.has(key)) continue;
      const fields = index.get(key) ?? '';
      index.set(key, `${fields} ${mismatch.leftField} ${mismatch.rightField} ${displayScalar(mismatch.leftValue)} ${displayScalar(mismatch.rightValue)}`);
    }
    return index;
  }, [result]);
  const preview = useMemo(() => result ? filteredPreview(result.comparisonPreview, onlyDifferences, query, status, previewSearchText) : [], [result, onlyDifferences, query, status, previewSearchText]);
  const allDifferenceRows = useMemo(() => result ? searchableDifferences(result) : [], [result]);
  const matchingDifferences = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('en-US');
    return allDifferenceRows.filter((row) => !normalized || `${row.key} ${row.field} ${row.left} ${row.right}`.toLocaleLowerCase('en-US').includes(normalized));
  }, [allDifferenceRows, query]);
  const visibleDifferences = matchingDifferences.slice(0, 100);
  const hasSearchControls = Boolean(result) && (tab === 'comparison' || tab === 'differences');

  return (
    <Card className="results-card">
      <CardHeader className="results-heading">
        <div>
          <CardTitle>Results</CardTitle>
          <CardDescription>{result ? `${result.summary.leftRows.toLocaleString()} vs ${result.summary.rightRows.toLocaleString()} rows` : 'Run a comparison to see results'}</CardDescription>
        </div>
        {hasSearchControls && <div className="result-filters">
          <div className="search-wrap"><Search aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search keys, fields, values…" aria-label="Search comparison results" /></div>
          {tab === 'comparison' && <Select value={status} onValueChange={(value) => setStatus(value as PreviewStatusFilter)}>
            <SelectTrigger className="status-filter" aria-label="Filter comparison status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS).map(([key, value]) => <SelectItem value={key} key={key}>{value.label}</SelectItem>)}
            </SelectContent>
          </Select>}
        </div>}
      </CardHeader>
      <CardContent className="results-content">
        <Tabs value={tab} onValueChange={onTabChange} aria-label="Reconciliation results">
          <TabsList className="result-tabs" variant="line">
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
            <TabsTrigger value="differences">Differences</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          <TabsContent value="comparison" className="tab-content">
            {!result ? <EmptyState>Choose both source files, then run reconciliation.</EmptyState> : <>
              <p className="filter-note" aria-live="polite">{onlyDifferences ? 'Differences only · ' : ''}{preview.length} of {result.comparisonPreview.length} key groups shown</p>
              <ComparisonTable rows={preview} previewTruncated={result.previewTruncated} onlyDifferences={onlyDifferences} />
            </>}
          </TabsContent>
          <TabsContent value="differences" className="tab-content">
            {!result ? <EmptyState>No result yet.</EmptyState> : <>
              <p className="filter-note" aria-live="polite">{visibleDifferences.length} of {matchingDifferences.length} matching difference details</p>
              <DifferenceTable rows={visibleDifferences} truncated={matchingDifferences.length > visibleDifferences.length} />
            </>}
          </TabsContent>
          <TabsContent value="summary" className="tab-content">
            {!result ? <EmptyState>No result yet.</EmptyState> : <Summary result={result} />}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
