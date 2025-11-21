"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReportsDir = getReportsDir;
exports.ensureReportsDir = ensureReportsDir;
exports.generateReportFilename = generateReportFilename;
exports.saveReport = saveReport;
exports.loadLatestReport = loadLatestReport;
exports.cleanupOldReports = cleanupOldReports;
exports.listReports = listReports;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const REPORTS_DIR = '.repo-guardian';
const REPORTS_SUBDIR = 'reports';
const MAX_AGE_DAYS = 7;
/**
 * Get the reports directory path
 */
function getReportsDir(workspacePath) {
    return path.join(workspacePath, REPORTS_DIR, REPORTS_SUBDIR);
}
/**
 * Ensure the reports directory exists
 */
function ensureReportsDir(workspacePath) {
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
        }
        catch (error) {
            // Ignore errors updating .gitignore
        }
    }
    catch (error) {
        console.error('Failed to create reports directory:', error);
    }
    return reportsDir;
}
/**
 * Generate a report filename based on timestamp
 */
function generateReportFilename() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    return `scan-${timestamp}.json`;
}
/**
 * Save a scan report to disk
 */
function saveReport(report, workspacePath) {
    const reportsDir = ensureReportsDir(workspacePath);
    const filename = generateReportFilename();
    const filePath = path.join(reportsDir, filename);
    try {
        const json = JSON.stringify(report, null, 2);
        fs.writeFileSync(filePath, json, 'utf-8');
        return filePath;
    }
    catch (error) {
        console.error('Failed to save report:', error);
        throw error;
    }
}
/**
 * Load the most recent report
 */
function loadLatestReport(workspacePath) {
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
        return JSON.parse(content);
    }
    catch (error) {
        console.error('Failed to load latest report:', error);
        return null;
    }
}
/**
 * Delete reports older than MAX_AGE_DAYS
 */
function cleanupOldReports(workspacePath) {
    const reportsDir = getReportsDir(workspacePath);
    try {
        if (!fs.existsSync(reportsDir)) {
            return 0;
        }
        const now = Date.now();
        const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000; // Convert days to milliseconds
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
    }
    catch (error) {
        console.error('Failed to cleanup old reports:', error);
        return 0;
    }
}
/**
 * List all available reports
 */
function listReports(workspacePath) {
    const reportsDir = getReportsDir(workspacePath);
    try {
        if (!fs.existsSync(reportsDir)) {
            return [];
        }
        return fs.readdirSync(reportsDir)
            .filter(f => f.startsWith('scan-') && f.endsWith('.json'))
            .sort()
            .reverse();
    }
    catch (error) {
        console.error('Failed to list reports:', error);
        return [];
    }
}
//# sourceMappingURL=reports.js.map