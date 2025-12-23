// Types for refactoring detection

export interface IfChainInfo {
  startLine: number;
  endLine: number;
  conditions: Array<{
    check: string; // e.g., "trimmed.includes('valid')"
    result: string; // e.g., "'validateInput'"
    checkType: "includes" | "startsWith" | "endsWith" | "equals" | "other";
    searchValue?: string | undefined; // extracted value being searched
  }>;
  defaultResult?: string | undefined;
  variableName: string; // The variable being checked
}

export interface SwitchInfo {
  startLine: number;
  endLine: number;
  expression: string;
  cases: Array<{
    value: string;
    result: string;
  }>;
  defaultResult?: string | undefined;
}

export interface CodeSection {
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  purpose: string;
}

export interface RefactoringResult {
  type:
    | "if-chain-to-map"
    | "switch-to-map"
    | "extract-section"
    | "guard-clause";
  originalCode: string;
  newCode: string;
  startLine: number;
  endLine: number;
  description: string;
}
