import { useId } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import type { Pair } from './dashboard-logic.js';

interface PairEditorProps {
  title: string;
  description: string;
  emptyLabel: string;
  leftColumns: string[];
  rightColumns: string[];
  pairs: Pair[];
  maxPairs: number;
  blockedLeft?: string[];
  blockedRight?: string[];
  onChange: (pairs: Pair[]) => void;
}

function PairEditor({
  title,
  description,
  emptyLabel,
  leftColumns,
  rightColumns,
  pairs,
  maxPairs,
  blockedLeft = [],
  blockedRight = [],
  onChange,
}: PairEditorProps) {
  const id = useId();
  const canAdd = pairs.length < maxPairs && leftColumns.length > 0 && rightColumns.length > 0;

  const updatePair = (index: number, side: 'left' | 'right', value: string): void => {
    onChange(pairs.map((pair, current) => current === index ? { ...pair, [side]: value } : pair));
  };

  const addPair = (): void => {
    const usedLeft = new Set([...blockedLeft, ...pairs.map((pair) => pair.left)]);
    const usedRight = new Set([...blockedRight, ...pairs.map((pair) => pair.right)]);
    const left = leftColumns.find((column) => !usedLeft.has(column));
    const right = rightColumns.find((column) => !usedRight.has(column));
    if (left && right) onChange([...pairs, { left, right }]);
  };

  const fieldChoices = (side: 'left' | 'right', currentIndex: number): string[] => {
    const columns = side === 'left' ? leftColumns : rightColumns;
    const blocked = new Set(side === 'left' ? blockedLeft : blockedRight);
    pairs.forEach((pair, index) => {
      if (index !== currentIndex) blocked.add(pair[side]);
    });
    const selected = pairs[currentIndex]?.[side];
    return columns.filter((column) => !blocked.has(column) || column === selected);
  };

  return (
    <section className="pair-editor" aria-label={title}>
      <div className="pair-editor-heading">
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="section-description">{description}</p>
        </div>
        <span className="pair-count">{pairs.length}/{maxPairs}</span>
      </div>
      {pairs.length === 0 && <p className="mapping-empty">{emptyLabel}</p>}
      <div className="pair-list">
        {pairs.map((pair, index) => {
          const leftId = `${id}-left-${index}`;
          const rightId = `${id}-right-${index}`;
          return (
            <div className="pair-row" key={`${index}-${pairs.length}`}>
              <div className="pair-select-field">
                <Label className="sr-only" htmlFor={leftId}>Source A field {index + 1}</Label>
                <Select value={pair.left} onValueChange={(value) => updatePair(index, 'left', value)}>
                  <SelectTrigger id={leftId} className="pair-select" aria-label={`Source A field ${index + 1}`}>
                    <SelectValue placeholder="Source A field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldChoices('left', index).map((column) => <SelectItem value={column} key={column}>{column}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <span className="pair-arrow" aria-hidden="true">→</span>
              <div className="pair-select-field">
                <Label className="sr-only" htmlFor={rightId}>Source B field {index + 1}</Label>
                <Select value={pair.right} onValueChange={(value) => updatePair(index, 'right', value)}>
                  <SelectTrigger id={rightId} className="pair-select" aria-label={`Source B field ${index + 1}`}>
                    <SelectValue placeholder="Source B field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldChoices('right', index).map((column) => <SelectItem value={column} key={column}>{column}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="remove-pair-button"
                aria-label={`Remove ${title.toLowerCase()} pair ${index + 1}`}
                onClick={() => onChange(pairs.filter((_, current) => current !== index))}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          );
        })}
      </div>
      <Button type="button" variant="outline" size="sm" className="add-pair-button" onClick={addPair} disabled={!canAdd}>
        <Plus aria-hidden="true" /> Add {title.toLowerCase()}
      </Button>
    </section>
  );
}

interface ReconciliationSettingsProps {
  leftColumns: string[];
  rightColumns: string[];
  keyPairs: Pair[];
  fieldPairs: Pair[];
  tolerance: string;
  toleranceInvalid: boolean;
  onKeyPairsChange: (pairs: Pair[]) => void;
  onFieldPairsChange: (pairs: Pair[]) => void;
  onToleranceChange: (value: string) => void;
}

export function ReconciliationSettings({
  leftColumns,
  rightColumns,
  keyPairs,
  fieldPairs,
  tolerance,
  toleranceInvalid,
  onKeyPairsChange,
  onFieldPairsChange,
  onToleranceChange,
}: ReconciliationSettingsProps) {
  return (
    <div className="reconciliation-settings">
      <PairEditor
        title="Match keys"
        description="Choose one or more fields to identify the same record. Order matters."
        emptyLabel="Select at least one key pair."
        leftColumns={leftColumns}
        rightColumns={rightColumns}
        pairs={keyPairs}
        maxPairs={10}
        onChange={onKeyPairsChange}
      />
      <PairEditor
        title="Compare fields"
        description="Map values to compare; different header names are supported."
        emptyLabel="No value fields selected."
        leftColumns={leftColumns}
        rightColumns={rightColumns}
        pairs={fieldPairs}
        maxPairs={100}
        blockedLeft={keyPairs.map((pair) => pair.left)}
        blockedRight={keyPairs.map((pair) => pair.right)}
        onChange={onFieldPairsChange}
      />
      <div className="tolerance-field">
        <div>
          <Label htmlFor="amount-tolerance">Numeric tolerance</Label>
          <p className="section-description">Absolute decimal difference allowed for numeric values.</p>
        </div>
        <div className="tolerance-input-wrap">
          <input
            id="amount-tolerance"
            className="tolerance-input"
            inputMode="decimal"
            autoComplete="off"
            value={tolerance}
            aria-invalid={toleranceInvalid}
            aria-describedby="tolerance-help"
            onChange={(event) => onToleranceChange(event.currentTarget.value)}
            placeholder="0"
          />
          <span className="tolerance-unit">decimal</span>
        </div>
        <p id="tolerance-help" className={`section-description ${toleranceInvalid ? 'error-message' : ''}`}>
          {toleranceInvalid ? 'Enter a non-negative decimal with up to 30 integer and 18 fractional digits.' : 'Leave 0 for exact matching. Base-10 comparison avoids floating-point rounding.'}
        </p>
      </div>
    </div>
  );
}
