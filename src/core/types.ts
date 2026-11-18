export type Scalar = string | number | boolean | null;
export type DataRow = Record<string, Scalar>;

export interface Dataset {
  name: string;
  columns: string[];
  rows: DataRow[];
}

export interface FieldPair {
  left: string;
  right: string;
}

export interface CompareOptions {
  keyPairs: FieldPair[];
  fieldPairs?: FieldPair[];
  tolerance?: string;
  trimWhitespace?: boolean;
  caseSensitiveKeys?: boolean;
  caseSensitiveValues?: boolean;
}

export interface DuplicateGroup {
  key: Record<string, Scalar>;
  count: number;
  records: DataRow[];
}

export type ComparisonStatus = 'match' | 'mismatch' | 'only_left' | 'only_right' | 'duplicate';

export interface ComparisonPreviewRow {
  key: string;
  status: ComparisonStatus;
  leftRows: number;
  rightRows: number;
  mismatchFields: number;
}

export interface ReconciliationResult {
  summary: {
    leftSource: string;
    rightSource: string;
    leftRows: number;
    rightRows: number;
    matchedKeys: number;
    matchedRows: number;
    mismatchedRows: number;
    missingOnLeft: number;
    missingOnRight: number;
    duplicateKeysOnLeft: number;
    duplicateKeysOnRight: number;
    valueMismatches: number;
    schemaIssues: number;
  };
  schema: {
    leftColumns: string[];
    rightColumns: string[];
    onlyOnLeft: string[];
    onlyOnRight: string[];
  };
  missing: {
    onlyOnLeft: DataRow[];
    onlyOnRight: DataRow[];
  };
  duplicates: {
    left: DuplicateGroup[];
    right: DuplicateGroup[];
  };
  mismatches: Array<{
    key: Record<string, Scalar>;
    leftField: string;
    rightField: string;
    leftValue: Scalar;
    rightValue: Scalar;
  }>;
  comparisonPreview: ComparisonPreviewRow[];
  previewTruncated: boolean;
  markdown: string;
}

export interface MultiReconcileOptions {
  sources: Dataset[];
  keyPairs: FieldPair[];
  fieldPairs?: FieldPair[];
  tolerance?: string;
  trimWhitespace?: boolean;
  caseSensitiveKeys?: boolean;
  caseSensitiveValues?: boolean;
}

export interface PairwiseResult {
  leftIndex: number;
  rightIndex: number;
  leftName: string;
  rightName: string;
  result: ReconciliationResult;
}

export interface MultiSourceReconciliationResult {
  sources: string[];
  pairwise: PairwiseResult[];
  totalSources: number;
  totalComparisons: number;
  aggregateSummary: {
    totalRows: number;
    totalMatches: number;
    totalMismatches: number;
    totalMissing: number;
    totalDuplicates: number;
    totalSchemaIssues: number;
    worstPair: { leftName: string; rightName: string; issueCount: number } | null;
  };
}
