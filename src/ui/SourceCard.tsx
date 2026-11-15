import type { ChangeEvent, DragEvent } from 'react';
import { Badge, Card, Text } from '@radix-ui/themes';
import { ACCEPTED_FILES, fileFormat, formatBytes, MAX_FILE_BYTES, type Side, type SourceUpload } from './dashboard-logic.js';

interface SourceCardProps {
  side: Side;
  upload: SourceUpload;
  onInspect: (side: Side, file: File) => void;
  onDraggingChange: (side: Side, dragging: boolean) => void;
  onSelectError: (side: Side, message: string) => void;
}

export function SourceCard({ side, upload, onInspect, onDraggingChange, onSelectError }: SourceCardProps) {
  const label = side === 'left' ? 'A' : 'B';
  const acceptHint = upload.file ? `${formatBytes(upload.file.size)} · ${upload.rowCount?.toLocaleString() ?? '—'} rows` : 'CSV or XLSX · max 4 MB';

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) onInspect(side, file);
  };

  const dropFile = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    onDraggingChange(side, false);
    if (event.dataTransfer.files.length > 1) {
      onSelectError(side, 'Drop one file at a time.');
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) onInspect(side, file);
  };

  const leaveDropzone = (event: DragEvent<HTMLLabelElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDraggingChange(side, false);
  };

  return (
    <Card className="source-card" size="3">
      <div className="source-heading">
        <Badge color={side === 'left' ? 'blue' : 'purple'} variant="soft" size="2">{label}</Badge>
        <div>
          <Text as="div" weight="bold">Source {label}</Text>
          <Text as="div" size="1" color="gray">{upload.file?.name ?? 'Choose a CSV or XLSX file'}</Text>
        </div>
      </div>
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
        <span className="drop-primary">{upload.busy ? 'Reading file…' : upload.file ? 'Drop a new file or browse' : `Drop file ${label} here`}</span>
        <span className="drop-secondary">{upload.error || acceptHint}</span>
        <span className="drop-action">Browse files</span>
      </label>
      {upload.file && !upload.error && (
        <div className="source-file-meta" aria-live="polite">
          <Badge color={fileFormat(upload.file.name) === 'xlsx' ? 'green' : 'blue'} variant="soft">{fileFormat(upload.file.name)?.toUpperCase()}</Badge>
          <Text size="1">{upload.columns.length} columns detected</Text>
        </div>
      )}
      {upload.columns.length > 0 && !upload.error && <div className="source-columns" aria-label={`Detected columns in source ${label}`}>
        {upload.columns.slice(0, 6).map((column) => <span key={column} className="column-chip" title={column}>{column}</span>)}
        {upload.columns.length > 6 && <span className="column-overflow">+{upload.columns.length - 6} more</span>}
      </div>}
      {upload.error && <Text as="p" role="alert" size="1" color="red" className="source-error">{upload.error}</Text>}
      {upload.busy && <Text as="p" role="status" aria-live="polite" size="1" color="gray" className="source-progress">Inspecting locally…</Text>}
      <span className="sr-only">Maximum file size {MAX_FILE_BYTES / 1024 / 1024} megabytes.</span>
    </Card>
  );
}
