import * as fs from 'fs';
import * as path from 'path';
import { scanFile, Detection, loadRules } from './detector';
import { maskDetections } from './masking';

export interface ScanOptions {
  workspacePath: string;
  filePatterns?: string[];
  ignorePaths?: string[];
}

export interface ScanReport {
  timestamp: string;
  workspacePath: string;
  filesScanned: number;
  detectionsFound: number;
  detections: Detection[];
}

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.repo-guardian',
  '.vscode',
  '*.log',
  '*.lock',
  'package-lock.json',
  'yarn.lock'
];

/**
 * Load ignore patterns from .safecommit-ignore file
 */
function loadIgnorePatterns(workspacePath: string): string[] {
  const ignorePath = path.join(workspacePath, '.safecommit-ignore');
  
  try {
    if (fs.existsSync(ignorePath)) {
      const content = fs.readFileSync(ignorePath, 'utf-8');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    }
  } catch (error) {
    console.error('Failed to load .safecommit-ignore:', error);
  }
  
  return [];
}

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath: string, workspacePath: string, ignorePatterns: string[]): boolean {
  const relativePath = path.relative(workspacePath, filePath);
  const allPatterns = [...DEFAULT_IGNORE_PATTERNS, ...ignorePatterns];
  
  for (const pattern of allPatterns) {
    // Simple pattern matching
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(relativePath) || regex.test(path.basename(filePath))) {
        return true;
      }
    } else {
      if (relativePath.includes(pattern) || path.basename(filePath) === pattern) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Recursively walk directory and collect text files
 */
function walkDirectory(dirPath: string, workspacePath: string, ignorePatterns: string[]): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (shouldIgnore(fullPath, workspacePath, ignorePatterns)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...walkDirectory(fullPath, workspacePath, ignorePatterns));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Failed to walk directory ${dirPath}:`, error);
  }
  
  return files;
}

/**
 * Scan workspace and return detections
 */
export function scanWorkspace(options: ScanOptions): ScanReport {
  const { workspacePath, ignorePaths = [] } = options;
  const rules = loadRules();
  const customIgnorePatterns = loadIgnorePatterns(workspacePath);
  const allIgnorePatterns = [...customIgnorePatterns, ...ignorePaths];
  
  // Walk directory and collect files
  const files = walkDirectory(workspacePath, workspacePath, allIgnorePatterns);
  
  // Scan all files
  const allDetections: Detection[] = [];
  let filesScanned = 0;
  
  for (const filePath of files) {
    try {
      const detections = scanFile(filePath, rules);
      if (detections.length > 0) {
        allDetections.push(...detections);
      }
      filesScanned++;
    } catch (error) {
      // Skip files that can't be scanned
      continue;
    }
  }
  
  // Mask all detections
  const maskedDetections = maskDetections(allDetections);
  
  return {
    timestamp: new Date().toISOString(),
    workspacePath,
    filesScanned,
    detectionsFound: maskedDetections.length,
    detections: maskedDetections
  };
}

/**
 * Scan specific files (used for staged files)
 */
export function scanFiles(filePaths: string[], workspacePath: string): ScanReport {
  const rules = loadRules();
  const allDetections: Detection[] = [];
  let filesScanned = 0;
  
  for (const filePath of filePaths) {
    try {
      // Make path absolute if relative
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(workspacePath, filePath);
      
      if (!fs.existsSync(absolutePath)) {
        continue;
      }
      
      const detections = scanFile(absolutePath, rules);
      if (detections.length > 0) {
        allDetections.push(...detections);
      }
      filesScanned++;
    } catch (error) {
      continue;
    }
  }
  
  // Mask all detections
  const maskedDetections = maskDetections(allDetections);
  
  return {
    timestamp: new Date().toISOString(),
    workspacePath,
    filesScanned,
    detectionsFound: maskedDetections.length,
    detections: maskedDetections
  };
}
