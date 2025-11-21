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
exports.loadRules = loadRules;
exports.clearRulesCache = clearRulesCache;
exports.scanText = scanText;
exports.scanFile = scanFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let cachedRules = null;
/**
 * Load detection rules from detectors.sample.json
 */
function loadRules(rulesPath) {
    if (cachedRules) {
        return cachedRules;
    }
    const defaultPath = path.join(__dirname, 'detectors.sample.json');
    const actualPath = rulesPath || defaultPath;
    try {
        const content = fs.readFileSync(actualPath, 'utf-8');
        cachedRules = JSON.parse(content);
        return cachedRules;
    }
    catch (error) {
        console.error(`Failed to load rules from ${actualPath}:`, error);
        return [];
    }
}
/**
 * Clear cached rules (useful for testing)
 */
function clearRulesCache() {
    cachedRules = null;
}
/**
 * Scan text content line by line and apply all detection rules
 */
function scanText(text, filePath = '', rules) {
    // Import maskSnippet here to avoid circular dependency
    const { maskSnippet } = require('./masking');
    const detectionRules = rules || loadRules();
    const detections = [];
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
            }
            catch (error) {
                console.error(`Invalid regex pattern for rule ${rule.id}:`, error);
            }
        }
    }
    return detections;
}
/**
 * Scan a file and return all detections
 */
function scanFile(filePath, rules) {
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
    }
    catch (error) {
        // File is likely binary or unreadable
        return [];
    }
}
//# sourceMappingURL=detector.js.map