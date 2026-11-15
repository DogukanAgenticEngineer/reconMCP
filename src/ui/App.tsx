import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Badge, Button, Card, Heading, Switch, Text, Theme } from '@radix-ui/themes';
import { chooseKeyPair, commonFieldPairs, emptyUpload, fileFormat, formatBytes, FORM_OVERHEAD_RESERVE, MAX_COMBINED_BYTES, MAX_FILE_BYTES, type ResultResponse, type Side, type SourceUpload } from './dashboard-logic.js';
import { ResultsPanel } from './ResultsPanel.js';
import { SourceCard } from './SourceCard.js';

type Preview = { columns: string[]; rowCount: number };
type ApiError = { error?: string };
type Appearance = 'light' | 'dark';

function safeError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') return payload.error;
  return fallback;
}

function App() {
  const [appearance, setAppearance] = useState<Appearance>('light');
  const [left, setLeft] = useState<SourceUpload>(emptyUpload);
  const [right, setRight] = useState<SourceUpload>(emptyUpload);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [reportUrl, setReportUrl] = useState('');
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [tab, setTab] = useState('comparison');
  const requestIds = useRef<Record<Side, number>>({ left: 0, right: 0 });
  const runRequestId = useRef(0);
  const runController = useRef<AbortController | null>(null);

  const setUpload = (side: Side): Dispatch<SetStateAction<SourceUpload>> => side === 'left' ? setLeft : setRight;
  const commonPairs = useMemo(() => commonFieldPairs(left.columns, right.columns), [left.columns, right.columns]);
  const keyPair = useMemo(() => chooseKeyPair(commonPairs), [commonPairs]);
  const fieldPairs = useMemo(() => commonPairs.filter((pair) => pair.left !== keyPair?.left || pair.right !== keyPair?.right), [commonPairs, keyPair]);
  const requestBytes = left.file && right.file
    ? left.file.size + right.file.size + new TextEncoder().encode(left.file.name).length + new TextEncoder().encode(right.file.name).length + FORM_OVERHEAD_RESERVE
    : 0;
  const overBudget = requestBytes > MAX_COMBINED_BYTES;
  const ready = Boolean(left.file && right.file && keyPair && !left.busy && !right.busy && !working && !overBudget);

  useEffect(() => {
    if (!result) {
      setReportUrl('');
      return;
    }
    const url = URL.createObjectURL(new Blob([`\uFEFF${result.reportCsv}`], { type: 'text/csv;charset=utf-8' }));
    setReportUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', appearance === 'dark' ? '#111827' : '#f5f7fa');
  }, [appearance]);

  const invalidateRun = (): void => {
    runRequestId.current += 1;
    runController.current?.abort();
    runController.current = null;
    setWorking(false);
  };

  const inspectFile = async (side: Side, file: File): Promise<void> => {
    const update = setUpload(side);
    const requestId = ++requestIds.current[side];
    invalidateRun();
    setError('');
    setResult(null);
    const format = fileFormat(file.name);
    if (!format) {
      update({ ...emptyUpload(), error: 'Choose a CSV or XLSX file.' });
      return;
    }
    if (file.size === 0) {
      update({ ...emptyUpload(), error: 'The selected file is empty.' });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      update({ ...emptyUpload(), error: 'File exceeds the 4 MB limit.' });
      return;
    }
    update({ file, columns: [], rowCount: null, busy: true, error: '', dragging: false });
    const form = new FormData();
    form.append('mode', 'inspect');
    form.append('source', JSON.stringify({ type: 'file', format, name: file.name }));
    form.append('file', file, file.name);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 16_000);
    try {
      const response = await fetch('/api/reconcile', { method: 'POST', body: form, signal: controller.signal });
      const payload = await response.json() as Preview & ApiError;
      if (!response.ok) throw new Error(safeError(payload, 'Could not read this file.'));
      if (requestIds.current[side] !== requestId) return;
      update((current) => ({ ...current, columns: payload.columns, rowCount: payload.rowCount, busy: false, error: '' }));
    } catch (cause) {
      if (requestIds.current[side] !== requestId) return;
      const message = controller.signal.aborted ? 'File inspection timed out. Try a smaller file.' : cause instanceof Error ? cause.message : 'Could not read this file.';
      update((current) => ({ ...current, columns: [], rowCount: null, busy: false, error: message }));
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const onSelectError = (side: Side, message: string): void => {
    const update = setUpload(side);
    requestIds.current[side] += 1;
    update({ ...emptyUpload(), error: message });
    invalidateRun();
    setResult(null);
    setError('');
  };

  const copyMcp = async (): Promise<void> => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(`${window.location.origin}/api/mcp`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Clipboard access is unavailable in this browser.');
    }
  };

  const run = async (): Promise<void> => {
    if (!left.file || !right.file || !keyPair || overBudget) return;
    const leftFormat = fileFormat(left.file.name);
    const rightFormat = fileFormat(right.file.name);
    if (!leftFormat || !rightFormat) return;
    const requestId = ++runRequestId.current;
    const controller = new AbortController();
    runController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 16_000);
    setWorking(true);
    setError('');
    setResult(null);
    const form = new FormData();
    form.append('mode', 'compare');
    form.append('left', JSON.stringify({ type: 'file', format: leftFormat, name: left.file.name }));
    form.append('right', JSON.stringify({ type: 'file', format: rightFormat, name: right.file.name }));
    form.append('keyPairs', JSON.stringify([keyPair]));
    form.append('fieldPairs', JSON.stringify(fieldPairs));
    form.append('trimWhitespace', String(trimWhitespace));
    form.append('caseSensitiveKeys', 'true');
    form.append('caseSensitiveValues', String(!ignoreCase));
    form.append('tolerance', '0');
    form.append('fileLeft', left.file, left.file.name);
    form.append('fileRight', right.file, right.file.name);
    try {
      const response = await fetch('/api/reconcile', { method: 'POST', body: form, signal: controller.signal });
      const payload = await response.json() as ResultResponse & ApiError;
      if (!response.ok) throw new Error(safeError(payload, 'Reconciliation failed.'));
      if (runRequestId.current !== requestId) return;
      setResult(payload as ResultResponse);
      setTab('comparison');
    } catch (cause) {
      if (runRequestId.current !== requestId) return;
      setError(controller.signal.aborted ? 'The request timed out after 15 seconds. No result was saved.' : cause instanceof Error ? cause.message : 'Reconciliation failed.');
    } finally {
      window.clearTimeout(timeout);
      if (runRequestId.current === requestId) {
        setWorking(false);
        runController.current = null;
      }
    }
  };

  const updateDragging = (side: Side, dragging: boolean): void => {
    setUpload(side)((current) => ({ ...current, dragging }));
  };

  return (
    <Theme appearance={appearance} accentColor="blue" grayColor="gray" radius="medium" scaling="100%">
      <div className="app-shell">
        <div className="dashboard-container">
          <header className="topbar">
            <div className="brand-block">
              <Heading as="h1" size="5" className="wordmark">Reconcile<span> MCP</span></Heading>
              <Text as="p" size="1" color="gray" className="brand-caption">Data reconciliation workspace</Text>
            </div>
            <div className="topbar-actions">
              <div className="theme-control">
                <Text as="label" htmlFor="theme-toggle" size="1">Dark</Text>
                <Switch id="theme-toggle" checked={appearance === 'dark'} onCheckedChange={(checked) => setAppearance(checked ? 'dark' : 'light')} aria-label="Toggle dark theme" />
              </div>
              <Button type="button" variant="outline" onClick={() => void copyMcp()} aria-label="Copy MCP endpoint URL">
                {copied ? 'Copied' : 'CONNECT MCP'}
              </Button>
            </div>
          </header>

          <main>
            <section className="source-grid" aria-label="Source files">
              <SourceCard side="left" upload={left} onInspect={inspectFile} onDraggingChange={updateDragging} onSelectError={onSelectError} />
              <SourceCard side="right" upload={right} onInspect={inspectFile} onDraggingChange={updateDragging} onSelectError={onSelectError} />
            </section>

            {keyPair && left.columns.length > 0 && right.columns.length > 0 && (
              <section className="mapping-strip" aria-label="Automatic field mapping">
                <Text size="1" color="gray">MATCH KEY</Text>
                <Badge color="blue" variant="soft">{keyPair.left}{keyPair.left === keyPair.right ? '' : ` → ${keyPair.right}`}</Badge>
                <Text size="1" color="gray">{fieldPairs.length} comparable fields</Text>
              </section>
            )}
            {left.columns.length > 0 && right.columns.length > 0 && !keyPair && (
              <Text as="p" role="status" className="inline-message">No common column names. RUN is unavailable.</Text>
            )}

            <section className="dashboard-workspace" aria-label="Reconciliation workspace">
              <ResultsPanel result={result} tab={tab} onTabChange={setTab} onlyDifferences={onlyDifferences} />
              <aside className="action-column" aria-label="Run and settings">
                <Card className="action-card" size="3">
                  <Text as="div" size="3" weight="bold">Run</Text>
                  <Text as="p" size="1" color="gray" className="action-copy">Compare the selected sources using the automatic key and mapped fields.</Text>
                  <Button type="button" className="run-button" onClick={() => void run()} disabled={!ready} aria-busy={working}>
                    {working ? 'Comparing…' : 'RUN'}
                  </Button>
                  {left.file && right.file && <Text as="div" size="1" color={overBudget ? 'red' : 'gray'} className="budget-note">Request budget: {formatBytes(requestBytes)} / 4.25 MB</Text>}
                  {overBudget && <Text as="p" role="alert" size="1" color="red">Combined files exceed the request limit.</Text>}
                  {error && <Text as="p" role="alert" className="error-message">{error}</Text>}
                  {result && reportUrl && <a className="download-button" href={reportUrl} download="reconcile-report.csv">Download CSV report</a>}
                  <div className="endpoint-info">
                    <Text as="div" size="1" weight="medium">MCP endpoint</Text>
                    <code>{window.location.origin}/api/mcp</code>
                    <Text as="div" size="1" color="gray" aria-live="polite">{copied ? 'Endpoint copied to clipboard.' : 'Connect from an MCP-compatible client.'}</Text>
                  </div>
                </Card>

                <Card className="settings-card" size="3">
                  <Text as="div" size="3" weight="bold">Options</Text>
                  <label className="setting-row" htmlFor="ignore-case">
                    <span><Text as="div" size="2" weight="medium">Ignore case (text)</Text><Text as="div" size="1" color="gray">Text values only</Text></span>
                    <Switch id="ignore-case" checked={ignoreCase} onCheckedChange={setIgnoreCase} aria-label="Ignore case in text values" />
                  </label>
                  <label className="setting-row" htmlFor="trim-whitespace">
                    <span><Text as="div" size="2" weight="medium">Trim whitespace</Text><Text as="div" size="1" color="gray">Leading and trailing</Text></span>
                    <Switch id="trim-whitespace" checked={trimWhitespace} onCheckedChange={setTrimWhitespace} aria-label="Trim leading and trailing whitespace" />
                  </label>
                  <label className="setting-row" htmlFor="only-differences">
                    <span><Text as="div" size="2" weight="medium">Show only differences</Text><Text as="div" size="1" color="gray">Filter comparison table</Text></span>
                    <Switch id="only-differences" checked={onlyDifferences} onCheckedChange={setOnlyDifferences} aria-label="Show only differences in the comparison table" />
                  </label>
                </Card>

                <Card className="privacy-card" size="2">
                  <Text as="div" size="1" weight="bold">No app-level data storage</Text>
                  <Text as="p" size="1" color="gray">Files and results are processed for the request only. Hosting-provider infrastructure logs are outside the app’s control.</Text>
                </Card>
              </aside>
            </section>
          </main>
          <footer className="page-footer">
            <Text size="1" color="gray">{MAX_FILE_BYTES / 1024 / 1024} MB per file · 10,000 rows per source · no persistent app storage</Text>
            <Text size="1" color="gray">{MAX_COMBINED_BYTES / 1024 / 1024} MB request limit</Text>
          </footer>
        </div>
      </div>
    </Theme>
  );
}

export default App;
