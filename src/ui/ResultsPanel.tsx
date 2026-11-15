import { Badge, Card, Flex, Progress, Table, Tabs, Text } from '@radix-ui/themes';
import type { ComparisonPreviewRow, ReconciliationResult } from '../core/types.js';
import { displayScalar, filteredPreview, matchedRate, shorten } from './dashboard-logic.js';

interface ResultsPanelProps {
  result: ReconciliationResult | null;
  tab: string;
  onTabChange: (value: string) => void;
  onlyDifferences: boolean;
}

const STATUS: Record<ComparisonPreviewRow['status'], { label: string; color: 'green' | 'red' | 'amber' | 'orange' | 'blue' }> = {
  match: { label: 'Match', color: 'green' },
  mismatch: { label: 'Mismatch', color: 'red' },
  only_left: { label: 'Only in A', color: 'amber' },
  only_right: { label: 'Only in B', color: 'blue' },
  duplicate: { label: 'Duplicate', color: 'orange' },
};

function KeyCell({ value }: { value: string }) {
  return <span className="cell-ellipsis" title={value} aria-label={value}>{shorten(value, 160)}</span>;
}

function ValueCell({ value }: { value: string }) {
  return <span className="cell-ellipsis" title={value} aria-label={value}>{shorten(value, 180)}</span>;
}

function EmptyState({ children }: { children: string }) {
  return <div className="empty-state"><Text size="2" color="gray">{children}</Text></div>;
}

function ComparisonTable({ rows, previewTruncated, onlyDifferences }: { rows: ComparisonPreviewRow[]; previewTruncated: boolean; onlyDifferences: boolean }) {
  if (rows.length === 0) return <EmptyState>{onlyDifferences ? 'No differences found. Turn off the filter to see matching records.' : 'No key groups to show.'}</EmptyState>;
  return (
    <>
      {previewTruncated && <Text as="p" size="1" color="gray" className="table-note">Showing the first 50 key groups. The CSV report contains all differences.</Text>}
      <div className="table-wrap">
        <Table.Root size="2" variant="surface" aria-label="Comparison preview">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Key</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="right">Rows A</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="right">Rows B</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="right">Different fields</Table.ColumnHeaderCell>
          </Table.Row></Table.Header>
          <Table.Body>
            {rows.map((row, index) => {
              const status = STATUS[row.status];
              return <Table.Row key={`${row.key}-${index}`}>
                <Table.Cell><KeyCell value={row.key} /></Table.Cell>
                <Table.Cell><Badge color={status.color} variant="soft">{status.label}</Badge></Table.Cell>
                <Table.Cell align="right">{row.leftRows}</Table.Cell>
                <Table.Cell align="right">{row.rightRows}</Table.Cell>
                <Table.Cell align="right">{row.mismatchFields || '—'}</Table.Cell>
              </Table.Row>;
            })}
          </Table.Body>
        </Table.Root>
      </div>
    </>
  );
}

function DifferenceTable({ result }: { result: ReconciliationResult }) {
  const visibleMismatchLimit = 50;
  const mismatches = result.mismatches.slice(0, visibleMismatchLimit);
  const duplicates = [
    ...result.duplicates.left.map((group) => ({ side: 'A', key: JSON.stringify(group.key), count: group.count })),
    ...result.duplicates.right.map((group) => ({ side: 'B', key: JSON.stringify(group.key), count: group.count })),
  ].slice(0, visibleMismatchLimit);
  const schemaRows = [
    ...result.schema.onlyOnLeft.map((field) => ({ side: 'A', field })),
    ...result.schema.onlyOnRight.map((field) => ({ side: 'B', field })),
  ];
  const total = result.mismatches.length + duplicates.length + schemaRows.length;
  if (total === 0) return <EmptyState>No value, duplicate or schema differences.</EmptyState>;

  return (
    <>
      {(result.mismatches.length > visibleMismatchLimit || result.duplicates.left.length + result.duplicates.right.length > visibleMismatchLimit) && (
        <Text as="p" size="1" color="gray" className="table-note">This view is limited to 50 entries per category. The CSV report contains all differences.</Text>
      )}
      <div className="table-wrap">
        <Table.Root size="2" variant="surface" aria-label="Difference details">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Key / field</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Difference</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Source A</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Source B</Table.ColumnHeaderCell>
          </Table.Row></Table.Header>
          <Table.Body>
            {mismatches.map((item, index) => <Table.Row key={`mismatch-${index}`}>
              <Table.Cell><KeyCell value={JSON.stringify(item.key)} /></Table.Cell>
              <Table.Cell>{item.leftField === item.rightField ? item.leftField : `${item.leftField} → ${item.rightField}`}</Table.Cell>
              <Table.Cell><ValueCell value={displayScalar(item.leftValue)} /></Table.Cell>
              <Table.Cell><ValueCell value={displayScalar(item.rightValue)} /></Table.Cell>
            </Table.Row>)}
            {duplicates.map((item, index) => <Table.Row key={`duplicate-${item.side}-${index}`}>
              <Table.Cell><KeyCell value={item.key} /></Table.Cell>
              <Table.Cell><Badge color="orange" variant="soft">Duplicate</Badge></Table.Cell>
              <Table.Cell>{item.side === 'A' ? `${item.count} rows` : '—'}</Table.Cell>
              <Table.Cell>{item.side === 'B' ? `${item.count} rows` : '—'}</Table.Cell>
            </Table.Row>)}
            {schemaRows.map((item, index) => <Table.Row key={`schema-${item.side}-${index}`}>
              <Table.Cell><KeyCell value={item.field} /></Table.Cell>
              <Table.Cell><Badge color="blue" variant="soft">Schema</Badge></Table.Cell>
              <Table.Cell>{item.side === 'A' ? 'Present' : '—'}</Table.Cell>
              <Table.Cell>{item.side === 'B' ? 'Present' : '—'}</Table.Cell>
            </Table.Row>)}
          </Table.Body>
        </Table.Root>
      </div>
      {(result.summary.missingOnLeft > 0 || result.summary.missingOnRight > 0) && (
        <div className="missing-note">
          <Text size="2" weight="medium">Missing records are listed in Comparison.</Text>
          <Text size="1" color="gray">Only in A: {result.summary.missingOnRight.toLocaleString()} · Only in B: {result.summary.missingOnLeft.toLocaleString()}</Text>
        </div>
      )}
    </>
  );
}

function Summary({ result }: { result: ReconciliationResult }) {
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
    <>
      <div className="metric-grid">
        {metrics.map((metric) => <Card key={metric.label} className={`metric-card metric-${metric.tone}`} size="2">
          <Text as="div" size="1" color="gray">{metric.label}</Text>
          <Text as="div" size="6" weight="bold" className="metric-value">{metric.value.toLocaleString()}</Text>
        </Card>)}
      </div>
      <Card className="rate-card" size="3">
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <div>
            <Text as="div" weight="medium">Exact match rate</Text>
            <Text as="div" size="1" color="gray">Among shared unique keys, excluding duplicate keys</Text>
          </div>
          <Text as="div" size="4" weight="bold">{summary.matchedKeys === 0 ? '—' : `${rate.toFixed(1)}%`}</Text>
        </Flex>
        <Progress className="match-progress" value={rate} aria-label="Exact match rate among shared unique keys" />
      </Card>
      <div className="source-count-line">
        <Text size="1" color="gray">{summary.leftSource}: {summary.leftRows.toLocaleString()} rows</Text>
        <Text size="1" color="gray">{summary.rightSource}: {summary.rightRows.toLocaleString()} rows</Text>
      </div>
    </>
  );
}

export function ResultsPanel({ result, tab, onTabChange, onlyDifferences }: ResultsPanelProps) {
  const preview = result ? filteredPreview(result.comparisonPreview, onlyDifferences) : [];
  return (
    <Card className="results-card" size="3">
      <div className="results-heading">
        <div>
          <Text as="div" size="4" weight="bold">Results</Text>
          <Text as="div" size="1" color="gray">{result ? `${result.summary.leftRows.toLocaleString()} vs ${result.summary.rightRows.toLocaleString()} rows` : 'Run a comparison to see results'}</Text>
        </div>
      </div>
      <Tabs.Root value={tab} onValueChange={onTabChange} aria-label="Reconciliation results">
        <Tabs.List className="result-tabs">
          <Tabs.Trigger value="comparison">Comparison</Tabs.Trigger>
          <Tabs.Trigger value="differences">Differences</Tabs.Trigger>
          <Tabs.Trigger value="summary">Summary</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="comparison" className="tab-content">
          {!result ? <EmptyState>Choose both source files, then run reconciliation.</EmptyState> : <>
            <div className="filter-note"><Text size="1" color="gray">{onlyDifferences ? 'Showing differences only' : 'Showing all key groups'}</Text></div>
            <ComparisonTable rows={preview} previewTruncated={result.previewTruncated} onlyDifferences={onlyDifferences} />
          </>}
        </Tabs.Content>
        <Tabs.Content value="differences" className="tab-content">
          {!result ? <EmptyState>No result yet.</EmptyState> : <DifferenceTable result={result} />}
        </Tabs.Content>
        <Tabs.Content value="summary" className="tab-content">
          {!result ? <EmptyState>No result yet.</EmptyState> : <Summary result={result} />}
        </Tabs.Content>
      </Tabs.Root>
    </Card>
  );
}
