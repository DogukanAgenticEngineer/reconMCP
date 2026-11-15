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
}

export interface DuplicateGroup {
  key: Record<string, Scalar>;
  count: number;
  records: DataRow[];
}

export interface ReconciliationResult {
  summary: {
    leftSource: string;
    rightSource: string;
    leftRows: number;
    rightRows: number;
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
  markdown: string;
}
