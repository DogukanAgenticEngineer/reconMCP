import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ReactElement } from 'react';
import { Moon, Sun } from 'lucide-react';
import { animate, stagger } from 'animejs';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Breadcrumb } from '@/components/ui/breadcrumb.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Label } from '@/components/ui/label.js';
import { Spinner } from '@/components/ui/spinner.js';
import { Switch } from '@/components/ui/switch.js';
import { McpConnectDialog } from './McpConnectDialog.js';
import { ReconciliationSettings } from './ReconciliationSettings.js';
import { chooseKeyPair, commonFieldPairs, emptyUpload, estimateMultipartRequestBytes, fileFormat, formatBytes, isValidPairSelection, isValidTolerance, MAX_COMBINED_BYTES, MAX_FIELD_PAIRS, MAX_FILE_BYTES, MAX_KEY_PAIRS, type Pair, type ResultResponse, type Side, type SourceUpload } from './dashboard-logic.js';
import { ResultsPanel } from './ResultsPanel.js';
import { SourceCard } from './SourceCard.js';

 type Preview = { columns: string[]; rowCount: number };
type ApiError = { error?: string };
type Appearance = 'light' | 'dark';

function safeError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') return payload.error;
  return fallback;
}

function App(): ReactElement {
  const [appearance, setAppearance] = useState<Appearance>('light');
  const [left, setLeft] = useState<SourceUpload>(emptyUpload);
  const [right, setRight] = useState<SourceUpload>(emptyUpload);
  const [keyPairs, setKeyPairs] = useState<Pair[]>([]);
  const [fieldPairs, setFieldPairs] = useState<Pair[]>([]);
  const [tolerance, setTolerance] = useState('0');
  const [working, setWorking] = useState(false);
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
  const toleranceInvalid = !isValidTolerance(tolerance);
  const keyPairsValid = isValidPairSelection(keyPairs, left.columns, right.columns, MAX_KEY_PAIRS, 1);
  const fieldPairsValid = isValidPairSelection(fieldPairs, left.columns, right.columns, MAX_FIELD_PAIRS)
    && !fieldPairs.some((field) => keyPairs.some((key) => key.left === field.left || key.right === field.right));
  const effectiveFieldPairs = fieldPairs.filter((field) => !keyPairs.some((key) => key.left === field.left || key.right === field.right));
  const requestBytes = left.file && right.file
    ? estimateMultipartRequestBytes([
      { name: 'mode', value: 'compare' },
      { name: 'left', value: JSON.stringify({ type: 'file', format: fileFormat(left.file.name) ?? 'csv', name: left.file.name }) },
      { name: 'right', value: JSON.stringify({ type: 'file', format: fileFormat(right.file.name) ?? 'csv', name: right.file.name }) },
      { name: 'keyPairs', value: JSON.stringify(keyPairs) },
      { name: 'fieldPairs', value: JSON.stringify(effectiveFieldPairs) },
      { name: 'trimWhitespace', value: String(trimWhitespace) },
      { name: 'caseSensitiveKeys', value: 'true' },
      { name: 'caseSensitiveValues', value: String(!ignoreCase) },
      { name: 'tolerance', value: tolerance || '0' },
    ], [
      { name: 'fileLeft', filename: left.file.name, size: left.file.size },
      { name: 'fileRight', filename: right.file.name, size: right.file.size },
    ])
    : 0;
  const overBudget = requestBytes > MAX_COMBINED_BYTES;
  const bothInspected = Boolean(left.file && right.file && left.columns.length > 0 && right.columns.length > 0 && !left.busy && !right.busy);
  const ready = Boolean(bothInspected && keyPairsValid && fieldPairsValid && !toleranceInvalid && !working && !overBudget);
  const endpoint = `${window.location.origin}/api/mcp`;

  // Motion 1–2: workspace entrance and staggered source-card reveal.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const headerMotion = animate('.topbar', { opacity: [0, 1], y: [-12, 0], duration: 620, ease: 'outExpo' });
    const sourceMotion = animate('.source-card', { opacity: [0, 1], y: [18, 0], delay: stagger(95), duration: 680, ease: 'outExpo' });
    return () => { headerMotion.pause(); sourceMotion.pause(); };
  }, []);

  // Motion 3: restrained processing pulse while reconciliation runs.
  useEffect(() => {
    if (!working || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const button = document.querySelector('.run-button');
    if (!button) return;
    const pulse = animate(button, { scale: [1, 1.025, 1], duration: 920, ease: 'inOutSine', loop: true });
    return () => pulse.pause();
  }, [working]);

  useEffect(() => {
    const automaticKey = chooseKeyPair(commonPairs);
    const defaults = automaticKey ? [automaticKey] : [];
    setKeyPairs(defaults);
    setFieldPairs(commonPairs.filter((pair) => !defaults.some((key) => key.left === pair.left || key.right === pair.right)));
  }, [commonPairs]);

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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', appearance === 'dark' ? '#101723' : '#f6f8fb');
  }, [appearance]);

  const invalidateRun = (): void => {
    runRequestId.current += 1;
    runController.current?.abort();
    runController.current = null;
    setWorking(false);
  };

  const clearResult = (): void => {
    if (runController.current) {
      runRequestId.current += 1;
      runController.current.abort();
      runController.current = null;
    }
    setWorking(false);
    setResult(null);
    setError('');
  };

  const inspectFile = async (side: Side, file: File): Promise<void> => {
    const update = setUpload(side);
    const requestId = ++requestIds.current[side];
    invalidateRun();
    clearResult();
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
    clearResult();
  };

  const updateKeyPairs = (next: Pair[]): void => {
    setKeyPairs(next);
    setFieldPairs((current) => current.filter((field) => !next.some((key) => key.left === field.left || key.right === field.right)));
    clearResult();
  };

  const updateFieldPairs = (next: Pair[]): void => {
    setFieldPairs(next);
    clearResult();
  };

  const run = async (): Promise<void> => {
    if (!ready || !left.file || !right.file) return;
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
    form.append('keyPairs', JSON.stringify(keyPairs));
    form.append('fieldPairs', JSON.stringify(effectiveFieldPairs));
    form.append('trimWhitespace', String(trimWhitespace));
    form.append('caseSensitiveKeys', 'true');
    form.append('caseSensitiveValues', String(!ignoreCase));
    form.append('tolerance', tolerance || '0');
    form.append('fileLeft', left.file, left.file.name);
    form.append('fileRight', right.file, right.file.name);
    try {
      const response = await fetch('/api/reconcile', { method: 'POST', body: form, signal: controller.signal });
      const payload = await response.json() as ResultResponse & ApiError;
      if (!response.ok) throw new Error(safeError(payload, 'Reconciliation failed.'));
      if (runRequestId.current !== requestId) return;
      setResult(payload);
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

  const updateSetting = (setter: (value: boolean) => void, value: boolean): void => {
    setter(value);
    clearResult();
  };

  return (
    <div className={`theme-root ${appearance === 'dark' ? 'dark' : ''}`}>
      <div className="app-shell dashboard-page" id="app-top">
        <div className="dashboard-container">
          <header className="topbar">
            <div className="brand-lockup">
              <img className="brand-avatar" src="/reconcile-agent-icon.png" alt="" />
              <div className="brand-block">
                <div className="brand-kicker">PRIVATE · DETERMINISTIC</div>
                <h1 className="wordmark">Reconcile <span>MCP</span></h1>
                <p className="brand-caption">Data reconciliation workspace</p>
              </div>
            </div>
            <div className="topbar-actions">
              <div className="theme-control">
                <Sun aria-hidden="true" className="theme-icon" />
                <Label htmlFor="theme-toggle" className="sr-only">Dark theme</Label>
                <Switch id="theme-toggle" checked={appearance === 'dark'} onCheckedChange={(checked) => setAppearance(checked ? 'dark' : 'light')} aria-label="Toggle dark theme" />
                <Moon aria-hidden="true" className="theme-icon" />
              </div>
              <McpConnectDialog endpoint={endpoint} />
            </div>
          </header>

          <Breadcrumb items={[{ label: 'Workspace', href: '#sources' }, { label: 'Reconciliation', current: true }]} />

          <main>
            <section className="source-grid" id="sources" aria-label="Source files">
              <SourceCard side="left" upload={left} onInspect={inspectFile} onDraggingChange={updateDragging} onSelectError={onSelectError} />
              <SourceCard side="right" upload={right} onInspect={inspectFile} onDraggingChange={updateDragging} onSelectError={onSelectError} />
            </section>

            {bothInspected && <Card className="mapping-card">
              <CardHeader className="mapping-header">
                <div>
                  <CardTitle>Matching logic</CardTitle>
                  <CardDescription>Set record keys and the values to compare. Defaults are inferred from shared headers.</CardDescription>
                </div>
                <Badge variant={keyPairsValid && fieldPairsValid && !toleranceInvalid ? 'secondary' : 'destructive'}>{keyPairs.length} key{keyPairs.length === 1 ? '' : 's'}</Badge>
              </CardHeader>
              <CardContent>
                <ReconciliationSettings
                  leftColumns={left.columns}
                  rightColumns={right.columns}
                  keyPairs={keyPairs}
                  fieldPairs={fieldPairs}
                  tolerance={tolerance}
                  toleranceInvalid={toleranceInvalid}
                  onKeyPairsChange={updateKeyPairs}
                  onFieldPairsChange={updateFieldPairs}
                  onToleranceChange={(value) => { setTolerance(value); clearResult(); }}
                />
                {(!keyPairsValid || !fieldPairsValid) && (
                  <Alert variant="destructive" className="mapping-alert"><AlertDescription>Choose unique fields that exist in both sources. Key and comparison fields cannot overlap.</AlertDescription></Alert>
                )}
              </CardContent>
            </Card>}
            {left.columns.length > 0 && right.columns.length > 0 && commonPairs.length === 0 && (
              <Alert role="status" className="inline-alert"><AlertDescription>No matching column names were found. Add the key and value mappings manually.</AlertDescription></Alert>
            )}

            <section className="dashboard-workspace" id="workspace" aria-label="Reconciliation workspace">
              <ResultsPanel result={result} tab={tab} onTabChange={setTab} onlyDifferences={onlyDifferences} />
              <aside className="action-column" aria-label="Run and comparison options">
                <Card className="action-card">
                  <CardHeader className="action-card-header">
                    <CardTitle>Run reconciliation</CardTitle>
                    <CardDescription>Compare the selected files using these matching rules.</CardDescription>
                  </CardHeader>
                  <CardContent className="action-card-content">
                    <Button type="button" className="run-button" onClick={() => void run()} disabled={!ready} aria-busy={working}>
                      {working ? <><Spinner className="button-spinner" /> Comparing…</> : 'RUN'}
                    </Button>
                    {left.file && right.file && <p className={`budget-note ${overBudget ? 'error-message' : ''}`}>Request budget: {formatBytes(requestBytes)} / 4.25 MB</p>}
                    {overBudget && <Alert variant="destructive" className="action-alert"><AlertDescription>Combined files exceed the request limit.</AlertDescription></Alert>}
                    {!keyPairsValid && bothInspected && <p className="action-hint">Select at least one valid key pair to enable RUN.</p>}
                    {error && <Alert variant="destructive" className="action-alert"><AlertDescription>{error}</AlertDescription></Alert>}
                    {result && reportUrl && <a className="download-button" href={reportUrl} download="reconcile-report.csv">Download complete CSV report</a>}
                  </CardContent>
                </Card>

                <Card className="settings-card">
                  <CardHeader className="settings-heading"><CardTitle>Options</CardTitle><CardDescription>Text matching behavior</CardDescription></CardHeader>
                  <CardContent className="settings-content">
                    <div className="setting-row">
                      <div><Label htmlFor="ignore-case">Ignore case</Label><p>Text values only</p></div>
                      <Switch id="ignore-case" checked={ignoreCase} onCheckedChange={(checked) => updateSetting(setIgnoreCase, checked)} aria-label="Ignore case in text values" />
                    </div>
                    <div className="setting-row">
                      <div><Label htmlFor="trim-whitespace">Trim whitespace</Label><p>Leading and trailing spaces</p></div>
                      <Switch id="trim-whitespace" checked={trimWhitespace} onCheckedChange={(checked) => updateSetting(setTrimWhitespace, checked)} aria-label="Trim leading and trailing whitespace" />
                    </div>
                    <div className="setting-row">
                      <div><Label htmlFor="only-differences">Show only differences</Label><p>Hide matching key groups</p></div>
                      <Switch id="only-differences" checked={onlyDifferences} onCheckedChange={setOnlyDifferences} aria-label="Show only differences in the comparison table" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="privacy-card">
                  <CardHeader className="privacy-heading"><Badge variant="outline">Privacy</Badge><CardTitle>No app-level storage</CardTitle></CardHeader>
                  <CardContent><p>Files and results are processed for the request only. Hosting-provider infrastructure logs are outside the app’s control.</p></CardContent>
                </Card>
              </aside>
            </section>
          </main>
          <footer className="page-footer">
            <span>{MAX_FILE_BYTES / 1024 / 1024} MB per file · 10,000 rows per source · in-memory processing</span>
            <span>{MAX_COMBINED_BYTES / 1024 / 1024} MB request limit</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default App;
