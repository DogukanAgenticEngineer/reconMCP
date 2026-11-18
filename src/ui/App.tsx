import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ReactElement } from 'react';
import { animate, stagger } from 'animejs';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Breadcrumb } from '@/components/ui/breadcrumb.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Label } from '@/components/ui/label.js';
import { Spinner } from '@/components/ui/spinner.js';
import { Switch } from '@/components/ui/switch.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.js';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler.js';
import { DitherField } from '@/components/ui/dither-field.js';
import { Pointer } from '@/components/ui/pointer.js';
import { TypingAnimation } from '@/components/ui/typing-animation.js';
import { Highlighter } from '@/components/ui/highlighter.js';
import { McpConnectDialog } from './McpConnectDialog.js';
import { ReconciliationSettings } from './ReconciliationSettings.js';
import { chooseKeyPair, commonFieldPairs, emptyUpload, estimateMultipartRequestBytes, estimateMultiSourceRequestBytes, fileFormat, formatBytes, isValidPairSelection, isValidTolerance, MAX_COMBINED_BYTES, MAX_FIELD_PAIRS, MAX_FILE_BYTES, MAX_KEY_PAIRS, MAX_SOURCES, MIN_SOURCES, type MultiSourceUpload, type Pair, type ResultResponse, type Side, type SourceUpload } from './dashboard-logic.js';
import type { MultiSourceReconciliationResult } from '../core/types.js';
import { ResultsPanel } from './ResultsPanel.js';
import { SourceCard } from './SourceCard.js';
import { OnboardingDialog } from './OnboardingDialog.js';

type Preview = { columns: string[]; rowCount: number };
type ApiError = { error?: string };
type Appearance = 'light' | 'dark';

function safeError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') return payload.error;
  return fallback;
}

function App(): ReactElement {
  const [appearance, setAppearance] = useState<Appearance>('light');
  const [multiMode, setMultiMode] = useState(false);
  const [multiSources, setMultiSources] = useState<MultiSourceUpload>([emptyUpload(), emptyUpload()]);
  const [multiResult, setMultiResult] = useState<MultiSourceReconciliationResult | null>(null);

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
  const multiRequestIds = useRef<number[]>([]);
  const runRequestId = useRef(0);
  const runController = useRef<AbortController | null>(null);

  const setUpload = (side: Side): Dispatch<SetStateAction<SourceUpload>> => side === 'left' ? setLeft : setRight;

  const activeColumnsA = useMemo(() => (multiMode ? (multiSources[0]?.columns ?? []) : left.columns), [multiMode, multiSources, left.columns]);
  const activeColumnsB = useMemo(() => (multiMode ? (multiSources[1]?.columns ?? []) : right.columns), [multiMode, multiSources, right.columns]);

  const commonPairs = useMemo(() => commonFieldPairs(activeColumnsA, activeColumnsB), [activeColumnsA, activeColumnsB]);
  const toleranceInvalid = !isValidTolerance(tolerance);
  const keyPairsValid = isValidPairSelection(keyPairs, activeColumnsA, activeColumnsB, MAX_KEY_PAIRS, 1);
  const fieldPairsValid = isValidPairSelection(fieldPairs, activeColumnsA, activeColumnsB, MAX_FIELD_PAIRS)
    && !fieldPairs.some((field) => keyPairs.some((key) => key.left === field.left || key.right === field.right));
  const effectiveFieldPairs = fieldPairs.filter((field) => !keyPairs.some((key) => key.left === field.left || key.right === field.right));

  const standardRequestBytes = left.file && right.file
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

  const multiUploadedFiles = multiSources.map((s) => s.file).filter((f): f is File => f !== null);
  const multiRequestBytes = multiMode && multiUploadedFiles.length >= MIN_SOURCES
    ? estimateMultiSourceRequestBytes(
      multiUploadedFiles.map((f) => ({ name: f.name, size: f.size })),
      [
        { name: 'keyPairs', value: JSON.stringify(keyPairs) },
        { name: 'fieldPairs', value: JSON.stringify(effectiveFieldPairs) },
        { name: 'trimWhitespace', value: String(trimWhitespace) },
        { name: 'caseSensitiveKeys', value: 'true' },
        { name: 'caseSensitiveValues', value: String(!ignoreCase) },
        { name: 'tolerance', value: tolerance || '0' },
      ],
    )
    : 0;

  const requestBytes = multiMode ? multiRequestBytes : standardRequestBytes;
  const overBudget = requestBytes > MAX_COMBINED_BYTES;

  const standardBothInspected = Boolean(left.file && right.file && left.columns.length > 0 && right.columns.length > 0 && !left.busy && !right.busy);
  const multiAllInspected = multiSources.length >= MIN_SOURCES && multiSources.every((s) => s.file && s.columns.length > 0 && !s.busy);
  const bothInspected = multiMode ? multiAllInspected : standardBothInspected;

  const ready = Boolean(bothInspected && keyPairsValid && fieldPairsValid && !toleranceInvalid && !working && !overBudget);
  const endpoint = `${window.location.origin}/api/mcp`;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const headerMotion = animate('.topbar', { opacity: [0, 1], y: [-12, 0], duration: 620, ease: 'outExpo' });
    const sourceMotion = animate('.source-card', { opacity: [0, 1], y: [18, 0], delay: stagger(95), duration: 680, ease: 'outExpo' });
    return () => { headerMotion.pause(); sourceMotion.pause(); };
  }, [multiMode]);

  useEffect(() => {
    if (!working || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const button = document.querySelector('.run-button');
    if (!button) return;
    const pulse = animate(button, { scale: [1, 1.025, 1], duration: 920, ease: 'inOutSine', loop: true });
    return () => { pulse.pause(); };
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
    setMultiResult(null);
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

  const inspectMultiFile = async (index: number, file: File): Promise<void> => {
    multiRequestIds.current[index] = (multiRequestIds.current[index] ?? 0) + 1;
    const reqId = multiRequestIds.current[index];
    invalidateRun();
    clearResult();
    const format = fileFormat(file.name);
    if (!format) {
      setMultiSources((cur) => cur.map((item, i) => i === index ? { ...emptyUpload(), error: 'Choose a CSV or XLSX file.' } : item));
      return;
    }
    if (file.size === 0) {
      setMultiSources((cur) => cur.map((item, i) => i === index ? { ...emptyUpload(), error: 'The selected file is empty.' } : item));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMultiSources((cur) => cur.map((item, i) => i === index ? { ...emptyUpload(), error: 'File exceeds the 4 MB limit.' } : item));
      return;
    }
    setMultiSources((cur) => cur.map((item, i) => i === index ? { file, columns: [], rowCount: null, busy: true, error: '', dragging: false } : item));
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
      if (multiRequestIds.current[index] !== reqId) return;
      setMultiSources((cur) => cur.map((item, i) => i === index ? { ...item, columns: payload.columns, rowCount: payload.rowCount, busy: false, error: '' } : item));
    } catch (cause) {
      if (multiRequestIds.current[index] !== reqId) return;
      const message = controller.signal.aborted ? 'File inspection timed out.' : cause instanceof Error ? cause.message : 'Could not read this file.';
      setMultiSources((cur) => cur.map((item, i) => i === index ? { ...item, columns: [], rowCount: null, busy: false, error: message } : item));
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const addMultiSource = (): void => {
    if (multiSources.length >= MAX_SOURCES) return;
    setMultiSources((cur) => [...cur, emptyUpload()]);
    clearResult();
  };

  const removeMultiSource = (index: number): void => {
    if (multiSources.length <= MIN_SOURCES) return;
    setMultiSources((cur) => cur.filter((_, i) => i !== index));
    clearResult();
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
    if (!ready) return;
    const requestId = ++runRequestId.current;
    const controller = new AbortController();
    runController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    setWorking(true);
    setError('');
    setResult(null);
    setMultiResult(null);

    try {
      if (multiMode) {
        const form = new FormData();
        form.append('mode', 'multi-compare');
        const sourcesMeta = multiSources.map((s) => ({
          type: 'file',
          format: fileFormat(s.file?.name ?? '') ?? 'csv',
          name: s.file?.name ?? 'data',
        }));
        form.append('sources', JSON.stringify(sourcesMeta));
        form.append('keyPairs', JSON.stringify(keyPairs));
        form.append('fieldPairs', JSON.stringify(effectiveFieldPairs));
        form.append('trimWhitespace', String(trimWhitespace));
        form.append('caseSensitiveKeys', 'true');
        form.append('caseSensitiveValues', String(!ignoreCase));
        form.append('tolerance', tolerance || '0');
        multiSources.forEach((s, idx) => {
          if (s.file) form.append(`fileSource_${idx}`, s.file, s.file.name);
        });

        const response = await fetch('/api/reconcile', { method: 'POST', body: form, signal: controller.signal });
        const payload = await response.json() as MultiSourceReconciliationResult & ApiError;
        if (!response.ok) throw new Error(safeError(payload, 'Multi-source reconciliation failed.'));
        if (runRequestId.current !== requestId) return;
        setMultiResult(payload);
        if (payload.pairwise.length > 0 && payload.pairwise[0]?.result) {
          setResult({ ...payload.pairwise[0].result, reportCsv: '' });
        }
      } else {
        if (!left.file || !right.file) return;
        const leftFormat = fileFormat(left.file.name);
        const rightFormat = fileFormat(right.file.name);
        if (!leftFormat || !rightFormat) return;

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

        const response = await fetch('/api/reconcile', { method: 'POST', body: form, signal: controller.signal });
        const payload = await response.json() as ResultResponse & ApiError;
        if (!response.ok) throw new Error(safeError(payload, 'Reconciliation failed.'));
        if (runRequestId.current !== requestId) return;
        setResult(payload);
        setTab('comparison');
      }
    } catch (cause) {
      if (runRequestId.current !== requestId) return;
      setError(controller.signal.aborted ? 'The request timed out. No result was saved.' : cause instanceof Error ? cause.message : 'Reconciliation failed.');
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
      <DitherField isDark={appearance === 'dark'} className="dither-bg" />
      <Pointer />
      <OnboardingDialog />
      <div className="app-shell dashboard-page" id="app-top">
        <div className="dashboard-container">
          <header className="topbar">
            <div className="brand-lockup">
              <img className="brand-avatar" src="/reconcile-agent-icon.png" alt="" />
              <div className="brand-block">
                <div className="brand-kicker">PRIVATE · DETERMINISTIC</div>
                <h1 className="wordmark">Reconcile <span>MCP</span></h1>
                <p className="brand-caption">
                  <TypingAnimation text="Data reconciliation workspace" duration={45} />
                </p>
              </div>
            </div>
            <div className="topbar-actions">
              <div className="theme-control">
                <AnimatedThemeToggler isDark={appearance === 'dark'} onToggle={() => setAppearance(appearance === 'dark' ? 'light' : 'dark')} />
              </div>
              <McpConnectDialog endpoint={endpoint} />
            </div>
          </header>

          <Breadcrumb items={[{ label: 'Workspace', href: '#sources' }, { label: 'Reconciliation', current: true }]} />

          <main>
            {/* Multi-Source Toggle Toolbar */}
            <div className="multi-source-toolbar">
              <div className="multi-source-controls">
                <Layers className="h-4 w-4 text-primary" />
                <div>
                  <Label htmlFor="multi-mode-toggle" className="text-xs font-semibold cursor-pointer">
                    Multi-Source Mode (2–10 files)
                  </Label>
                  <p className="text-[10px] text-muted-foreground m-0">Compare multiple files simultaneously with full pairwise reconciliation</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="multi-mode-toggle"
                  checked={multiMode}
                  onCheckedChange={(checked) => { setMultiMode(checked); clearResult(); }}
                  aria-label="Toggle multi-source mode"
                />
                {multiMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMultiSource}
                    disabled={multiSources.length >= MAX_SOURCES}
                    className="gap-1 text-xs h-7"
                  >
                    <Plus className="h-3 w-3" /> Add Source ({multiSources.length}/{MAX_SOURCES})
                  </Button>
                )}
              </div>
            </div>

            {/* Source Cards */}
            {multiMode ? (
              <section className="multi-source-grid" aria-label="Multi-source files">
                {multiSources.map((upload, idx) => (
                  <div key={idx} className="multi-source-card-wrapper">
                    {multiSources.length > MIN_SOURCES && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMultiSource(idx)}
                        className="remove-source-btn text-destructive hover:bg-destructive/10"
                        title="Remove source"
                        aria-label={`Remove source ${idx + 1}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    <SourceCard
                      side={idx === 0 ? 'left' : 'right'}
                      index={idx}
                      upload={upload}
                      onInspect={(_, file) => void inspectMultiFile(idx, file)}
                      onDraggingChange={(_, dragging) => {
                        setMultiSources((cur) => cur.map((item, i) => i === idx ? { ...item, dragging } : item));
                      }}
                      onSelectError={(_, msg) => {
                        setMultiSources((cur) => cur.map((item, i) => i === idx ? { ...emptyUpload(), error: msg } : item));
                      }}
                    />
                  </div>
                ))}
              </section>
            ) : (
              <section className="source-grid" id="sources" aria-label="Source files">
                <SourceCard side="left" upload={left} onInspect={inspectFile} onDraggingChange={updateDragging} onSelectError={onSelectError} />
                <SourceCard side="right" upload={right} onInspect={inspectFile} onDraggingChange={updateDragging} onSelectError={onSelectError} />
              </section>
            )}

            {bothInspected && (
              <Card className="mapping-card">
                <CardHeader className="mapping-header">
                  <div>
                    <CardTitle>Matching logic</CardTitle>
                    <CardDescription>Set record keys and the values to compare. Defaults are inferred from shared headers.</CardDescription>
                  </div>
                  <Badge variant={keyPairsValid && fieldPairsValid && !toleranceInvalid ? 'secondary' : 'destructive'}>
                    <Highlighter>{keyPairs.length}</Highlighter> key{keyPairs.length === 1 ? '' : 's'}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <ReconciliationSettings
                    leftColumns={activeColumnsA}
                    rightColumns={activeColumnsB}
                    keyPairs={keyPairs}
                    fieldPairs={fieldPairs}
                    tolerance={tolerance}
                    toleranceInvalid={toleranceInvalid}
                    onKeyPairsChange={updateKeyPairs}
                    onFieldPairsChange={updateFieldPairs}
                    onToleranceChange={(value) => { setTolerance(value); clearResult(); }}
                  />
                  {(!keyPairsValid || !fieldPairsValid) && (
                    <Alert variant="destructive" className="mapping-alert">
                      <AlertDescription>Choose unique fields that exist in sources. Key and comparison fields cannot overlap.</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Multi-Source Pairwise Summary Table */}
            {multiMode && multiResult && (
              <Card className="pairwise-table-card">
                <CardHeader>
                  <CardTitle>Multi-Source Reconciliation Summary</CardTitle>
                  <CardDescription>
                    Analyzed {multiResult.totalSources} datasets across {multiResult.totalComparisons} pairwise comparisons ({multiResult.aggregateSummary.totalRows.toLocaleString()} total rows)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="table-wrap">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Comparison Pair</TableHead>
                          <TableHead className="numeric-cell">Matches</TableHead>
                          <TableHead className="numeric-cell">Mismatches</TableHead>
                          <TableHead className="numeric-cell">Missing (L / R)</TableHead>
                          <TableHead className="numeric-cell">Duplicates</TableHead>
                          <TableHead className="numeric-cell">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {multiResult.pairwise.map((pair, pIdx) => {
                          const issues = pair.result.summary.valueMismatches + pair.result.summary.missingOnLeft + pair.result.summary.missingOnRight;
                          return (
                            <TableRow key={pIdx}>
                              <TableCell className="font-medium text-xs">
                                <span className="font-semibold">{pair.leftName}</span> ↔ <span className="font-semibold">{pair.rightName}</span>
                              </TableCell>
                              <TableCell className="numeric-cell text-xs font-mono">
                                <Highlighter color="hsl(152 55% 35% / 20%)">{pair.result.summary.matchedRows.toLocaleString()}</Highlighter>
                              </TableCell>
                              <TableCell className="numeric-cell text-xs font-mono">
                                {pair.result.summary.valueMismatches > 0 ? (
                                  <Highlighter color="hsl(0 70% 48% / 20%)">{pair.result.summary.valueMismatches.toLocaleString()}</Highlighter>
                                ) : '0'}
                              </TableCell>
                              <TableCell className="numeric-cell text-xs font-mono text-muted-foreground">
                                {pair.result.summary.missingOnRight} / {pair.result.summary.missingOnLeft}
                              </TableCell>
                              <TableCell className="numeric-cell text-xs font-mono">
                                {pair.result.summary.duplicateKeysOnLeft + pair.result.summary.duplicateKeysOnRight}
                              </TableCell>
                              <TableCell className="numeric-cell">
                                <Badge variant={issues === 0 ? 'default' : 'destructive'} className="text-[10px]">
                                  {issues === 0 ? 'MATCHED' : `${issues} ISSUES`}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            <section className="dashboard-workspace" id="workspace" aria-label="Reconciliation workspace">
              <ResultsPanel result={result} tab={tab} onTabChange={setTab} onlyDifferences={onlyDifferences} />
              <aside className="action-column" aria-label="Run and comparison options">
                <Card className="action-card">
                  <CardHeader className="action-card-header">
                    <CardTitle>Run reconciliation</CardTitle>
                    <CardDescription>
                      {multiMode ? `Compare ${multiSources.filter((s) => s.file).length} files pairwise.` : 'Compare the selected files using these matching rules.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="action-card-content">
                    <Button type="button" className="run-button" onClick={() => void run()} disabled={!ready} aria-busy={working}>
                      {working ? <><Spinner className="button-spinner" /> Comparing…</> : multiMode ? `RUN MULTI (${multiSources.filter((s) => s.file).length})` : 'RUN'}
                    </Button>
                    {bothInspected && <p className={`budget-note ${overBudget ? 'error-message' : ''}`}>Request budget: {formatBytes(requestBytes)} / 4.25 MB</p>}
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
