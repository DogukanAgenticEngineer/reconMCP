import { useState } from 'react';
import type { ReactElement } from 'react';
import { Check, Copy } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.js';

const MCP_TOOLS = [
  'compare_datasets',
  'find_missing_records',
  'detect_duplicates',
  'detect_value_mismatches',
  'generate_report',
];

const OUTPUT_STEPS = [
  { label: 'Outcome', detail: 'Matched or needs review.' },
  { label: 'Metrics', detail: 'Matches, value differences and records only in A or B.' },
  { label: 'Differences', detail: 'Readable Markdown tables with bounded, safely formatted samples.' },
  { label: 'Structured data', detail: 'reconcile.result.v1 for client-native rendering; full CSV via generate_report.' },
];

export function McpConnectDialog({ endpoint }: { endpoint: string }): ReactElement {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  const copyEndpoint = async (): Promise<void> => {
    setCopyError('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable.');
      await navigator.clipboard.writeText(endpoint);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError('Clipboard access is unavailable. Select and copy the endpoint above.');
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="connect-button">CONNECT MCP</Button>
      </DialogTrigger>
      <DialogContent className="mcp-dialog">
        <DialogHeader>
          <Badge variant="secondary" className="dialog-kicker">MCP · Streamable HTTP</Badge>
          <DialogTitle>Connect Reconcile MCP</DialogTitle>
          <DialogDescription>Add this endpoint in an MCP-compatible client. This window copies the endpoint; it does not connect the client for you.</DialogDescription>
        </DialogHeader>
        <div className="endpoint-copy-block">
          <span className="field-caption">Endpoint</span>
          <div className="endpoint-copy-row">
            <code className="endpoint-code">{endpoint}</code>
            <Button type="button" size="sm" onClick={() => void copyEndpoint()}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          {copyError && <Alert variant="destructive" className="mcp-copy-alert"><AlertDescription>{copyError}</AlertDescription></Alert>}
          <p className="copy-status" role="status" aria-live="polite">{copied ? 'Endpoint copied.' : 'Paste the URL into your MCP client’s server configuration.'}</p>
        </div>
        <div className="mcp-tools-block">
          <div className="mcp-tools-heading"><span className="field-caption">Available tools</span><span className="mcp-tool-count">{MCP_TOOLS.length}</span></div>
          <ul className="mcp-tool-list">
            {MCP_TOOLS.map((tool) => <li key={tool}><code>{tool}</code></li>)}
          </ul>
        </div>
        <div className="mcp-output-shape">
          <span className="field-caption">Client-ready result</span>
          <ol className="mcp-output-list">
            {OUTPUT_STEPS.map((step, index) => (
              <li key={step.label}>
                <Badge variant="outline" className="mcp-output-number">{String(index + 1).padStart(2, '0')}</Badge>
                <div><strong>{step.label}</strong><span>{step.detail}</span></div>
              </li>
            ))}
          </ol>
          <p className="mcp-output-note">Every tool returns readable Markdown and structured content. Claude/ChatGPT rendering depends on the client.</p>
        </div>
        <p className="mcp-privacy-note">Requests are processed in memory and not saved by the app. Hosting-provider infrastructure logging may be outside the app’s control.</p>
      </DialogContent>
    </Dialog>
  );
}
