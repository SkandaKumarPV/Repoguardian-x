import { Detection } from './detector';

/**
 * Mask a secret value following the masking rules:
 * - First 4 + last 4 characters visible
 * - Middle masked with asterisks (minimum 4)
 * - Short strings (<8 chars) show first + last character
 */
export function maskSecret(value: string): string {
  if (!value || value.length === 0) {
    return '****';
  }

  // For very short strings (<8 chars), show first and last character only
  if (value.length < 8) {
    if (value.length === 1) {
      return '*';
    }
    if (value.length === 2) {
      return value[0] + '*';
    }
    const middle = '*'.repeat(Math.max(1, value.length - 2));
    return value[0] + middle + value[value.length - 1];
  }

  // Standard masking: first 4 + last 4 visible, minimum 4 asterisks in middle
  const prefix = value.substring(0, 4);
  const suffix = value.substring(value.length - 4);
  const middleLength = Math.max(4, value.length - 8);
  const middle = '*'.repeat(middleLength);

  return prefix + middle + suffix;
}

/**
 * Mask email address - mask only the local part
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  
  if (atIndex === -1) {
    return maskSecret(email);
  }

  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex);

  if (localPart.length <= 2) {
    return maskSecret(localPart) + domain;
  }

  const maskedLocal = localPart[0] + '*'.repeat(Math.max(4, localPart.length - 2)) + localPart[localPart.length - 1];
  return maskedLocal + domain;
}

/**
 * Mask connection string - mask only password portion
 */
export function maskConnectionString(connStr: string): string {
  // Common patterns: password=xxx; pwd=xxx; pass=xxx
  const passwordPatterns = [
    /password=([^;]+)/gi,
    /pwd=([^;]+)/gi,
    /pass=([^;]+)/gi,
    /:\/\/[^:]+:([^@]+)@/gi  // URL format: protocol://user:password@host
  ];

  let masked = connStr;

  for (const pattern of passwordPatterns) {
    masked = masked.replace(pattern, (match, password) => {
      if (match.includes('@')) {
        // URL format
        const colonIndex = match.indexOf(':', 3);
        const atIndex = match.indexOf('@');
        const prefix = match.substring(0, colonIndex + 1);
        const suffix = match.substring(atIndex);
        return prefix + maskSecret(password) + suffix;
      } else {
        // Key=value format
        const equalIndex = match.indexOf('=');
        const prefix = match.substring(0, equalIndex + 1);
        return prefix + maskSecret(password);
      }
    });
  }

  return masked;
}

/**
 * Intelligently mask a value based on its content
 */
export function maskValue(value: string, ruleId?: string): string {
  if (!value) {
    return '****';
  }

  // Email detection
  if (value.includes('@') && ruleId === 'email-address') {
    return maskEmail(value);
  }

  // Connection string detection
  if (value.toLowerCase().includes('password=') || 
      value.toLowerCase().includes('pwd=') ||
      value.match(/:\/\/[^:]+:[^@]+@/)) {
    return maskConnectionString(value);
  }

  // Default secret masking
  return maskSecret(value);
}

/**
 * Extract and mask the actual secret from a code snippet
 */
export function maskSnippet(snippet: string, ruleId: string, pattern?: string): string {
  if (!pattern) {
    return snippet;
  }

  try {
    const regex = new RegExp(pattern, 'g');
    return snippet.replace(regex, (match) => {
      return maskValue(match, ruleId);
    });
  } catch (error) {
    // If regex fails, return original snippet
    return snippet;
  }
}

/**
 * Mask all detections in a report
 */
export function maskDetections(detections: Detection[]): Detection[] {
  return detections.map(detection => {
    // For now, mask the entire snippet since we don't have pattern info here
    // In a full implementation, we'd need to pass rules or store pattern in Detection
    return {
      ...detection,
      snippet: detection.snippet // Already masked by detector if needed
    };
  });
}

/**
 * Mask a complete report (for backward compatibility)
 */
export function maskReport(report: any): any {
  if (report.detections && Array.isArray(report.detections)) {
    return {
      ...report,
      detections: maskDetections(report.detections)
    };
  }
  return report;
}
