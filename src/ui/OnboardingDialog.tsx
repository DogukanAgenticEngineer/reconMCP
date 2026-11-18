import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import {
  ArrowLeft, ArrowRight, BarChart3, Check, FileSpreadsheet,
  GitCompareArrows, PlugZap, ShieldCheck, Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent } from '@/components/ui/card.js';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog.js';
import { Progress } from '@/components/ui/progress.js';

const STORAGE_KEY = 'reconcile-mcp:onboarding:v1:completed';

const steps = [
  {
    eyebrow: 'WELCOME TO RECONCILE MCP',
    title: 'Know what changed. Know what matters.',
    description: 'A focused workspace for reconciling two datasets, finding inconsistencies and turning the results into something you can act on.',
    icon: Sparkles,
    points: [
      { icon: FileSpreadsheet, title: 'Bring two sources', description: 'Compare CSV and Excel workbooks side by side.' },
      { icon: GitCompareArrows, title: 'Reconcile with rules', description: 'Match records by keys and compare the fields that matter.' },
      { icon: BarChart3, title: 'Understand the outcome', description: 'Explore differences, quality signals and an exportable report.' },
    ],
  },
  {
    eyebrow: '01 · ADD YOUR SOURCES',
    title: 'Start with two files.',
    description: 'Drop a CSV or XLSX file into each source panel. Reconcile MCP inspects the columns and row counts before you run a comparison.',
    icon: FileSpreadsheet,
    points: [
      { icon: FileSpreadsheet, title: 'Source A and Source B', description: 'Choose one file for each side; each file can be up to 4 MB.' },
      { icon: Check, title: 'Review detected columns', description: 'The workspace reads the headers and helps you map matching fields.' },
      { icon: ShieldCheck, title: 'Request-scoped processing', description: 'Files are processed for the request; the app does not keep a persistent file library.' },
    ],
  },
  {
    eyebrow: '02 · DEFINE THE MATCH',
    title: 'Tell it how records relate.',
    description: 'Choose the fields that identify the same record, then select which values should be compared. Shared column names are suggested automatically.',
    icon: GitCompareArrows,
    points: [
      { icon: GitCompareArrows, title: 'Key fields', description: 'Use one or more matching field pairs to identify corresponding records.' },
      { icon: Check, title: 'Comparison fields', description: 'Review or adjust the fields included in the value comparison.' },
      { icon: ShieldCheck, title: 'Fine-tune matching', description: 'Set numeric tolerance, case handling and whitespace behavior.' },
    ],
  },
  {
    eyebrow: '03 · RUN AND EXPLORE',
    title: 'Turn a comparison into insight.',
    description: 'Run reconciliation once the two sources and matching rules are ready. Then move between the detailed results and the analytics report.',
    icon: BarChart3,
    points: [
      { icon: GitCompareArrows, title: 'Comparison and differences', description: 'Search records, filter statuses and inspect mismatched values.' },
      { icon: BarChart3, title: 'Summary and analytics', description: 'Review match rates, structural issues and data-driven charts.' },
      { icon: PlugZap, title: 'Export or connect', description: 'Download the complete CSV report or open Connect MCP to use the tools from an MCP client.' },
    ],
  },
] as const;

export function OnboardingDialog(): ReactElement {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  // Keep the active step defined even if state is ever outside the tuple bounds.
  const current = steps[step] ?? steps[0];
  const StepIcon = current.icon;

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(STORAGE_KEY) !== 'true');
    } catch {
      setOpen(true);
    }
  }, []);

  const finish = (): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // The onboarding remains dismissible when browser storage is unavailable.
    }
    setOpen(false);
  };

  const next = (): void => {
    if (step === steps.length - 1) finish();
    else setStep((value) => Math.min(value + 1, steps.length - 1));
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) finish(); }}>
      <DialogContent className="onboarding-dialog" aria-describedby="onboarding-description">
        <div className="onboarding-topline">
          <div className="onboarding-brand">
            <span className="onboarding-brand-mark"><GitCompareArrows aria-hidden="true" /></span>
            <span>RECONCILE <strong>MCP</strong></span>
          </div>
          <Badge variant="outline">QUICK TOUR</Badge>
        </div>

        <DialogHeader className="onboarding-heading">
          <div className="onboarding-step-meta">
            <Badge variant="secondary">{current.eyebrow}</Badge>
            <span>{String(step + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
          </div>
          <div className="onboarding-hero-icon"><StepIcon aria-hidden="true" /></div>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription id="onboarding-description">{current.description}</DialogDescription>
        </DialogHeader>

        <Progress className="onboarding-progress" value={((step + 1) / steps.length) * 100} aria-label="Onboarding progress" />

        <div className="onboarding-feature-grid">
          {current.points.map((point, index) => {
            const PointIcon = point.icon;
            return (
              <Card className="onboarding-feature" key={point.title}>
                <CardContent>
                  <span className="onboarding-feature-icon"><PointIcon aria-hidden="true" /></span>
                  <div>
                    <strong>{point.title}</strong>
                    <p>{point.description}</p>
                  </div>
                  <span className="onboarding-feature-index">{String(index + 1).padStart(2, '0')}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter className="onboarding-footer">
          <Button variant="ghost" onClick={finish}>Skip tour</Button>
          <div className="onboarding-navigation">
            {step > 0 && <Button variant="outline" onClick={() => setStep((value) => Math.max(value - 1, 0))}><ArrowLeft /> Back</Button>}
            <Button onClick={next}>{step === steps.length - 1 ? 'Start reconciling' : 'Continue'} {step === steps.length - 1 ? <Check /> : <ArrowRight />}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
