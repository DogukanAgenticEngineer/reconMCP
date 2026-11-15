import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, Dispatch, SetStateAction } from 'react';
import { Button, Card, Heading, Table, Text } from '@radix-ui/themes';
import type { FieldPair, ReconciliationResult, Scalar } from '../core/types.js';

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_COMBINED_BYTES = Math.floor(4.25 * 1024 * 1024);
const FORM_OVERHEAD_RESERVE = 4096;
const ACCEPTED_FILES = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type Side = 'left' | 'right';
type Upload = { file: File | null; columns: string[]; busy: boolean; error: string; dragging: boolean };
type Preview = { columns: string[]; rowCount: number };
type ResultResponse = ReconciliationResult & { reportCsv: string };
const emptyUpload = (): Upload => ({ file: null, columns: [], busy: false, error: '', dragging: false });

function fileFormat(file: File): 'csv' | 'xlsx' | null {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  return null;
}

function displayScalar(value: Scalar | undefined): string {
  if (value === null || value === undefined) return '—';
  return typeof value === 'string' ? value : String(value);
}

function App() {
  const [left, setLeft] = useState<Upload>(emptyUpload);
  const [right, setRight] = useState<Upload>(emptyUpload);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [reportUrl, setReportUrl] = useState('');
  const requestIds = useRef<Record<Side, number>>({ left: 0, right: 0 });

  const commonColumns = useMemo(
    () => left.columns.filter((column) => right.columns.includes(column)),
    [left.columns, right.columns],
  );
  const preferredKeys = new Set(['id', 'uuid', 'key', 'recordid', 'invoiceid', 'transactionid', 'accountid', 'customerid', 'reference', 'ref', 'code']);
  const keyField = commonColumns.find((column) => preferredKeys.has(column.toLowerCase().replace(/[^a-z0-9]/g, ''))) ?? commonColumns[0] ?? '';
  const setUpload = (side: Side): Dispatch<SetStateAction<Upload>> => side === 'left' ? setLeft : setRight;

  useEffect(() => {
    if (!result) {
      setReportUrl('');
      return;
    }
    const url = URL.createObjectURL(new Blob([`\uFEFF${result.reportCsv}`], { type: 'text/csv;charset=utf-8' }));
    setReportUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  const inspectFile = async (side: Side, file: File): Promise<void> => {
    const update = setUpload(side);
    const requestId = ++requestIds.current[side];
    const format = fileFormat(file);
    setError('');
    setResult(null);
    if (!format) {
      update({ file: null, columns: [], busy: false, error: 'CSV / XLSX', dragging: false });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      update({ file: null, columns: [], busy: false, error: 'MAX 4 MB', dragging: false });
      return;
    }
    update({ file, columns: [], busy: true, error: '', dragging: false });
    const form = new FormData();
    form.append('mode', 'inspect');
    form.append('source', JSON.stringify({ type: 'file', format, name: file.name }));
    form.append('file', file, file.name);
    try {
      const response = await fetch('/api/reconcile', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(16_000),
      });
      const payload = await response.json() as Preview & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'FILE ERROR');
      if (requestIds.current[side] !== requestId) return;
      update((current) => ({ ...current, columns: payload.columns, busy: false, error: '' }));
    } catch (cause) {
      if (requestIds.current[side] !== requestId) return;
      const message = cause instanceof Error && cause.name === 'TimeoutError' ? 'TIMEOUT' : cause instanceof Error ? cause.message : 'FILE ERROR';
      update((current) => ({ ...current, columns: [], busy: false, error: message }));
    }
  };

  const onFileChange = (side: Side, event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void inspectFile(side, file);
  };

  const onDrop = (side: Side, event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    setUpload(side)((current) => ({ ...current, dragging: false }));
    if (file) void inspectFile(side, file);
  };

  const copyMcp = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/api/mcp`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('CLIPBOARD UNAVAILABLE');
    }
  };

  const run = async (): Promise<void> => {
    if (!left.file || !right.file || !keyField) return;
    const fileBytes = left.file.size + right.file.size;
    const nameBytes = new TextEncoder().encode(left.file.name).length + new TextEncoder().encode(right.file.name).length;
    if (fileBytes + nameBytes + FORM_OVERHEAD_RESERVE > MAX_COMBINED_BYTES) {
      setError('MAX REQUEST 4.25 MB');
      return;
    }
    setWorking(true);
    setError('');
    setResult(null);
    const formatLeft = fileFormat(left.file);
    const formatRight = fileFormat(right.file);
    if (!formatLeft || !formatRight) {
      setWorking(false);
      setError('CSV / XLSX');
      return;
    }
    const form = new FormData();
    form.append('mode', 'compare');
    form.append('left', JSON.stringify({ type: 'file', format: formatLeft, name: left.file.name }));
    form.append('right', JSON.stringify({ type: 'file', format: formatRight, name: right.file.name }));
    form.append('keyPairs', JSON.stringify([{ left: keyField, right: keyField }]));
    const fieldPairs: FieldPair[] = commonColumns.filter((column) => column !== keyField).map((column) => ({ left: column, right: column }));
    form.append('fieldPairs', JSON.stringify(fieldPairs));
    form.append('trimWhitespace', 'true');
    form.append('caseSensitiveKeys', 'true');
    form.append('tolerance', '0');
    form.append('fileLeft', left.file, left.file.name);
    form.append('fileRight', right.file, right.file.name);
    try {
      const response = await fetch('/api/reconcile', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(16_000),
      });
      const payload = await response.json() as ResultResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'RUN FAILED');
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === 'TimeoutError' ? 'TIMEOUT · 15 SEC' : cause instanceof Error ? cause.message : 'RUN FAILED');
    } finally {
      setWorking(false);
    }
  };

  const ready = Boolean(left.file && right.file && keyField && !left.busy && !right.busy && !working);
  const totalMissing = result ? result.summary.missingOnLeft + result.summary.missingOnRight : 0;
  const totalDuplicates = result ? result.summary.duplicateKeysOnLeft + result.summary.duplicateKeysOnRight : 0;

  return (
    <main className="app-shell min-h-screen px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <Heading as="h1" size="5" className="wordmark">Reconcile MCP</Heading>
          <Button type="button" className="mcp-button" variant="outline" onClick={() => void copyMcp()} aria-label="MCP bağlantı adresini kopyala">
            {copied ? 'COPIED' : 'CONNECT MCP'}
          </Button>
        </header>

        <section className="grid gap-4 sm:grid-cols-2" aria-label="Kaynak dosyaları">
          {([['left', 'A', left], ['right', 'B', right]] as const).map(([side, label, source]) => (
            <Card key={side} size="4" className="drop-card">
              <Text as="div" size="1" className="side-label">{label}</Text>
              <label
                htmlFor={`source-${side}`}
                className={`drop-zone ${source.dragging ? 'is-dragging' : ''} ${source.error ? 'has-error' : ''}`}
                onDragOver={(event) => { event.preventDefault(); setUpload(side)((current) => ({ ...current, dragging: true })); }}
                onDragLeave={() => setUpload(side)((current) => ({ ...current, dragging: false }))}
                onDrop={(event) => onDrop(side, event)}
              >
                <input
                  id={`source-${side}`}
                  className="sr-only"
                  type="file"
                  accept={ACCEPTED_FILES}
                  aria-label={`Kaynak ${label} CSV veya XLSX dosyası`}
                  onChange={(event) => onFileChange(side, event)}
                />
                <span className="drop-primary">{source.busy ? 'READING' : source.file ? source.file.name : `DROP ${label}`}</span>
                <span className="drop-secondary">{source.error || (source.file ? `${(source.file.size / 1024).toFixed(0)} KB` : 'CSV / XLSX · MAX 4 MB')}</span>
              </label>
            </Card>
          ))}
        </section>

        {keyField && (
          <section className="match-row" aria-label="Eşleşme alanı">
            <Text size="1" className="side-label">KEY</Text>
            <Text size="2">{keyField}</Text>
          </section>
        )}
        {left.columns.length > 0 && right.columns.length > 0 && commonColumns.length === 0 && <Text as="p" role="status" className="status-line">NO COMMON KEY</Text>}

        <div className="run-row">
          <Button type="button" className="run-button" onClick={() => void run()} disabled={!ready} aria-busy={working}>
            RUN
          </Button>
        </div>

        {error && <Text as="p" role="alert" className="status-line">{error}</Text>}

        {result && (
          <section className="results" aria-live="polite">
            <div className="summary-line">
              <span>{result.summary.leftRows} / {result.summary.rightRows}</span>
              <span>MISSING {totalMissing}</span>
              <span>DUPLICATE {totalDuplicates}</span>
              <span>VALUE {result.summary.valueMismatches}</span>
              <span>SCHEMA {result.summary.schemaIssues}</span>
            </div>
            {reportUrl && <a className="report-link" href={reportUrl} download="reconcile-report.csv">CSV</a>}
            {result.mismatches.length > 20 && <Text as="p" size="1" className="status-line">SHOWING 20 OF {result.mismatches.length}</Text>}
            {result.mismatches.length > 0 && (
              <div className="table-wrap">
                <Table.Root size="1" variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>KEY</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>FIELD</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>A</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>B</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {result.mismatches.slice(0, 20).map((item, index) => (
                      <Table.Row key={`${index}-${item.leftField}`}>
                        <Table.Cell>{JSON.stringify(item.key)}</Table.Cell>
                        <Table.Cell>{item.leftField}</Table.Cell>
                        <Table.Cell>{displayScalar(item.leftValue)}</Table.Cell>
                        <Table.Cell>{displayScalar(item.rightValue)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </div>
            )}
          </section>
        )}

        <Text size="1" className="retention-note">NO STORAGE</Text>
      </div>
    </main>
  );
}

export default App;
