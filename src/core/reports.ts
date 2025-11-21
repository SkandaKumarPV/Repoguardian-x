import * as fs from 'fs';
import * as path from 'path';
import { ScanReport } from './scanner';

const REPORTS_DIR = '.repo-guardian';
const REPORTS_SUBDIR = 'reports';
const DEFAULT_MAX_AGE_DAYS = 7;

/**
 * Get the reports directory path
 */
export function getReportsDir(workspacePath: string): string {
  return path.join(workspacePath, REPORTS_DIR, REPORTS_SUBDIR);
}

/**
 * Ensure the reports directory exists
 */
export function ensureReportsDir(workspacePath: string): string {
  const reportsDir = getReportsDir(workspacePath);
  
  try {
    fs.mkdirSync(reportsDir, { recursive: true });
    
    // Ensure .repo-guardian is in .gitignore
    const gitignorePath = path.join(workspacePath, '.gitignore');
    try {
      let gitignoreContent = '';
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      }
      
      if (!gitignoreContent.includes(REPORTS_DIR)) {
        const newContent = gitignoreContent.trim() + '\n\n# RepoGuardian reports\n' + REPORTS_DIR + '/\n';
        fs.writeFileSync(gitignorePath, newContent);
      }
    } catch (error) {
      // Ignore errors updating .gitignore
    }
  } catch (error) {
    console.error('Failed to create reports directory:', error);
  }
  
  return reportsDir;
}

/**
 * Generate a report filename based on timestamp
 */
export function generateReportFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return `scan-${timestamp}.json`;
}

/**
 * Save a scan report to disk
 */
export function saveReport(report: ScanReport, workspacePath: string): string {
  const reportsDir = ensureReportsDir(workspacePath);
  const filename = generateReportFilename();
  const filePath = path.join(reportsDir, filename);
  
  try {
    const json = JSON.stringify(report, null, 2);
    fs.writeFileSync(filePath, json, 'utf-8');
    return filePath;
  } catch (error) {
    console.error('Failed to save report:', error);
    throw error;
  }
}

/**
 * Load the most recent report
 */
export function loadLatestReport(workspacePath: string): ScanReport | null {
  const reportsDir = getReportsDir(workspacePath);
  
  try {
    if (!fs.existsSync(reportsDir)) {
      return null;
    }
    
    const files = fs.readdirSync(reportsDir)
      .filter(f => f.startsWith('scan-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      return null;
    }
    
    const latestFile = path.join(reportsDir, files[0]);
    const content = fs.readFileSync(latestFile, 'utf-8');
    return JSON.parse(content) as ScanReport;
  } catch (error) {
    console.error('Failed to load latest report:', error);
    return null;
  }
}

/**
 * Delete reports older than specified days
 */
export function cleanupOldReports(workspacePath: string, maxAgeDays?: number): number {
  const reportsDir = getReportsDir(workspacePath);
  
  try {
    if (!fs.existsSync(reportsDir)) {
      return 0;
    }
    
    const now = Date.now();
    const ageDays = maxAgeDays || DEFAULT_MAX_AGE_DAYS;
    const maxAge = ageDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    const files = fs.readdirSync(reportsDir);
    let deletedCount = 0;
    
    for (const file of files) {
      if (!file.startsWith('scan-') || !file.endsWith('.json')) {
        continue;
      }
      
      const filePath = path.join(reportsDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtime.getTime();
      
      if (age > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old reports:', error);
    return 0;
  }
}

/**
 * List all available reports
 */
export function listReports(workspacePath: string): string[] {
  const reportsDir = getReportsDir(workspacePath);
  
  try {
    if (!fs.existsSync(reportsDir)) {
      return [];
    }
    
    return fs.readdirSync(reportsDir)
      .filter(f => f.startsWith('scan-') && f.endsWith('.json'))
      .sort()
      .reverse();
  } catch (error) {
    console.error('Failed to list reports:', error);
    return [];
  }
}
