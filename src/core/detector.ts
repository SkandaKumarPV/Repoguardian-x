import * as fs from 'fs';
import * as path from 'path';

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
  ruleName: string;
  severity: Severity;
  snippet: string;
  filePath: string;
  line: number;
  description?: string;
}

let cachedRules: Rule[] | null = null;

/**
 * Load detection rules from detectors.sample.json
 */
export function loadRules(rulesPath?: string): Rule[] {
  if (cachedRules) {
    return cachedRules;
  }

  const defaultPath = path.join(__dirname, 'detectors.sample.json');
  const actualPath = rulesPath || defaultPath;

  try {
    const content = fs.readFileSync(actualPath, 'utf-8');
    cachedRules = JSON.parse(content) as Rule[];
    return cachedRules;
  } catch (error) {
    console.error(`Failed to load rules from ${actualPath}:`, error);
    return [];
  }
}

/**
 * Clear cached rules (useful for testing)
 */
export function clearRulesCache(): void {
  cachedRules = null;
}

/**
 * Scan text content line by line and apply all detection rules
 */
export function scanText(text: string, filePath: string = '', rules?: Rule[]): Detection[] {
  // Import maskSnippet here to avoid circular dependency
  const { maskSnippet } = require('./masking');
  
  const detectionRules = rules || loadRules();
  const detections: Detection[] = [];
  const lines = text.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineContent = lines[lineIndex];
    const lineNumber = lineIndex + 1;

    for (const rule of detectionRules) {
      if (!rule.pattern) {
        continue;
      }

      try {
        const regex = new RegExp(rule.pattern, 'g');
        let match;

        while ((match = regex.exec(lineContent)) !== null) {
          // Mask the snippet before storing
          const maskedSnippet = maskSnippet(lineContent.trim(), rule.id, rule.pattern);
          
          detections.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            snippet: maskedSnippet,
            filePath: filePath,
            line: lineNumber,
            description: rule.description
          });
        }
      } catch (error) {
        console.error(`Invalid regex pattern for rule ${rule.id}:`, error);
      }
    }
  }

  return detections;
}

/**
 * Scan a file and return all detections
 */
export function scanFile(filePath: string, rules?: Rule[]): Detection[] {
  try {
    // Check file size (skip files > 10MB)
    const stats = fs.statSync(filePath);
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (stats.size > maxSize) {
      return [];
    }

    // Skip binary files by attempting to read as text
    const content = fs.readFileSync(filePath, 'utf-8');
    return scanText(content, filePath, rules);
  } catch (error) {
    // File is likely binary or unreadable
    return [];
  }
}
