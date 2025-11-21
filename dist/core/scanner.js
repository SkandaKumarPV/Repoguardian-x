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
exports.scanWorkspace = scanWorkspace;
exports.scanFiles = scanFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const detector_1 = require("./detector");
const masking_1 = require("./masking");
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
function loadIgnorePatterns(workspacePath) {
    const ignorePath = path.join(workspacePath, '.safecommit-ignore');
    try {
        if (fs.existsSync(ignorePath)) {
            const content = fs.readFileSync(ignorePath, 'utf-8');
            return content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
        }
    }
    catch (error) {
        console.error('Failed to load .safecommit-ignore:', error);
    }
    return [];
}
/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath, workspacePath, ignorePatterns) {
    const relativePath = path.relative(workspacePath, filePath);
    const allPatterns = [...DEFAULT_IGNORE_PATTERNS, ...ignorePatterns];
    for (const pattern of allPatterns) {
        // Simple pattern matching
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            if (regex.test(relativePath) || regex.test(path.basename(filePath))) {
                return true;
            }
        }
        else {
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
function walkDirectory(dirPath, workspacePath, ignorePatterns) {
    const files = [];
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (shouldIgnore(fullPath, workspacePath, ignorePatterns)) {
                continue;
            }
            if (entry.isDirectory()) {
                files.push(...walkDirectory(fullPath, workspacePath, ignorePatterns));
            }
            else if (entry.isFile()) {
                files.push(fullPath);
            }
        }
    }
    catch (error) {
        console.error(`Failed to walk directory ${dirPath}:`, error);
    }
    return files;
}
/**
 * Scan workspace and return detections
 */
function scanWorkspace(options) {
    const { workspacePath, ignorePaths = [], maxFileSize = 1048576 } = options;
    const rules = (0, detector_1.loadRules)();
    const customIgnorePatterns = loadIgnorePatterns(workspacePath);
    const allIgnorePatterns = [...customIgnorePatterns, ...ignorePaths];
    // Walk directory and collect files
    const files = walkDirectory(workspacePath, workspacePath, allIgnorePatterns);
    // Scan all files
    const allDetections = [];
    let filesScanned = 0;
    for (const filePath of files) {
        try {
            // Check file size
            const stats = fs.statSync(filePath);
            if (stats.size > maxFileSize) {
                continue; // Skip files larger than maxFileSize
            }
            const detections = (0, detector_1.scanFile)(filePath, rules);
            if (detections.length > 0) {
                allDetections.push(...detections);
            }
            filesScanned++;
        }
        catch (error) {
            // Skip files that can't be scanned
            continue;
        }
    }
    // Mask all detections
    const maskedDetections = (0, masking_1.maskDetections)(allDetections);
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
function scanFiles(filePaths, workspacePath) {
    const rules = (0, detector_1.loadRules)();
    const allDetections = [];
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
            const detections = (0, detector_1.scanFile)(absolutePath, rules);
            if (detections.length > 0) {
                allDetections.push(...detections);
            }
            filesScanned++;
        }
        catch (error) {
            continue;
        }
    }
    // Mask all detections
    const maskedDetections = (0, masking_1.maskDetections)(allDetections);
    return {
        timestamp: new Date().toISOString(),
        workspacePath,
        filesScanned,
        detectionsFound: maskedDetections.length,
        detections: maskedDetections
    };
}
//# sourceMappingURL=scanner.js.map