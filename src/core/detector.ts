export type Severity = 'info'|'warning'|'error';
export interface Rule {
  id: string;
  name: string;
  severity: Severity;
  pattern?: string;
  description?: string;
  examples?: string[];
  allowlist_contexts?: string[];
}
export interface Detection {
  ruleId: string;
  snippet: string;
  filePath: string;
  line: number;
}
export function scanText(_text: string): Detection[] {
  return [];
}
