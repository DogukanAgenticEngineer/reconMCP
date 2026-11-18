import type { ChangeEvent, DragEvent } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Spinner } from '@/components/ui/spinner.js';
import { ACCEPTED_FILES, fileFormat, formatBytes, MAX_FILE_BYTES, type Side, type SourceUpload } from './dashboard-logic.js';

interface SourceCardProps {
  side: Side;
  upload: SourceUpload;
  onInspect: (side: Side, file: File) => void;
  onDraggingChange: (side: Side, dragging: boolean) => void;
  onSelectError: (side: Side, message: string) => void;
  /** Optional numeric index shown instead of A/B when in multi-source mode. */
  index?: number;
}

export function SourceCard({ side, upload, onInspect, onDraggingChange, onSelectError, index }: SourceCardProps) {
  const label = index !== undefined ? String(index + 1) : (side === 'left' ? 'A' : 'B');
  const acceptHint = upload.file
    ? `${formatBytes(upload.file.size)} · ${upload.rowCount?.toLocaleString() ?? '—'} rows`
    : 'CSV or XLSX · max 4 MB';

  const selectFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) onInspect(side, file);
  };

  const dropFile = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    onDraggingChange(side, false);
    if (event.dataTransfer.files.length > 1) {
      onSelectError(side, 'Drop one file at a time.');
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) onInspect(side, file);
  };

  const leaveDropzone = (event: DragEvent<HTMLLabelElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDraggingChange(side, false);
  };

  return (
    <Card className={`source-card ${upload.file ? 'source-card-ready' : ''}`}>
      <CardHeader className="source-card-header">
        <div className="source-heading">
          <Badge variant={side === 'left' ? 'default' : 'secondary'} className={`source-badge source-badge-${side}`}>{label}</Badge>
          <div className="source-title-group">
            <CardTitle>Source {label}</CardTitle>
            <CardDescription className="source-name">{upload.file?.name ?? 'Choose a CSV or XLSX file'}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="source-card-content">
        <label
          className={`drop-zone ${upload.dragging ? 'is-dragging' : ''} ${upload.error ? 'has-error' : ''} ${upload.busy ? 'is-busy' : ''}`}
          htmlFor={`source-${side}`}
          onDragOver={(event) => { event.preventDefault(); onDraggingChange(side, true); }}
          onDragLeave={leaveDropzone}
          onDrop={dropFile}
        >
          <input
            id={`source-${side}`}
            className="visually-hidden-file"
            type="file"
            accept={ACCEPTED_FILES}
            aria-label={`Choose source ${label} CSV or XLSX file`}
            onChange={selectFile}
          />
          <span className="drop-icon-wrap" aria-hidden="true">
            {upload.busy ? <Spinner /> : <Upload className="drop-icon" />}
          </span>
          <span className="drop-primary">{upload.busy ? 'Reading file…' : upload.file ? 'Drop a new file or browse' : `Drop file ${label} here`}</span>
          <span className="drop-secondary">{acceptHint}</span>
          <span className="drop-action">Browse files</span>
        </label>
        {upload.file && !upload.error && (
          <div className="source-file-meta" aria-live="polite">
            <Badge variant="outline" className="file-type-badge"><FileSpreadsheet aria-hidden="true" />{fileFormat(upload.file.name)?.toUpperCase()}</Badge>
            <span className="metadata-copy">{upload.columns.length} columns detected</span>
          </div>
        )}
        {upload.columns.length > 0 && !upload.error && (
          <div className="source-columns" aria-label={`Detected columns in source ${label}`}>
            {upload.columns.slice(0, 7).map((column) => <span key={column} className="column-chip" title={column}>{column}</span>)}
            {upload.columns.length > 7 && <span className="column-overflow">+{upload.columns.length - 7} more</span>}
          </div>
        )}
        {upload.error && <Alert variant="destructive" className="source-alert"><AlertDescription>{upload.error}</AlertDescription></Alert>}
        {upload.busy && <p role="status" aria-live="polite" className="source-progress">Inspecting in memory…</p>}
        <span className="sr-only">Maximum file size {MAX_FILE_BYTES / 1024 / 1024} megabytes.</span>
      </CardContent>
    </Card>
  );
}
