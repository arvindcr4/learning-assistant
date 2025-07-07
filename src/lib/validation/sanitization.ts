// Import DOMPurify with proper server-side support
let purify: any;

if (typeof window !== 'undefined') {
  // Client-side
  const DOMPurify = require('dompurify');
  purify = DOMPurify;
} else {
  // Server-side
  const DOMPurify = require('dompurify');
  const { JSDOM } = require('jsdom');
  const window = new JSDOM('').window;
  purify = DOMPurify(window as any);
}

// ====================
// SANITIZATION UTILITIES
// ====================

export interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  stripTags?: boolean;
  escapeHtml?: boolean;
  maxLength?: number;
  allowedProtocols?: string[];
  removeEmptyElements?: boolean;
}

/**
 * Default safe configuration for HTML sanitization
 */
const DEFAULT_SAFE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
    'a', 'img', 'code', 'pre', 'span', 'div'
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id', 'target'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ['script', 'object', 'embed', 'link', 'style', 'iframe'],
  FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur'],
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM_IMPORT: false,
};

/**
 * Sanitizes HTML content to prevent XSS attacks
 */
export function sanitizeHtml(
  html: string,
  options: SanitizationOptions = {}
): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Apply length limit
  if (options.maxLength && html.length > options.maxLength) {
    html = html.substring(0, options.maxLength);
  }

  // Configure purify based on options
  const config = { ...DEFAULT_SAFE_CONFIG };

  if (options.allowedTags) {
    config.ALLOWED_TAGS = options.allowedTags;
  }

  if (options.allowedAttributes) {
    const allowedAttr: string[] = [];
    Object.values(options.allowedAttributes).forEach(attrs => {
      allowedAttr.push(...attrs);
    });
    config.ALLOWED_ATTR = allowedAttr;
  }

  if (options.stripTags) {
    config.ALLOWED_TAGS = [];
  }

  // Sanitize the HTML
  let sanitized = purify.sanitize(html, config);

  // Remove empty elements if requested
  if (options.removeEmptyElements) {
    sanitized = removeEmptyElements(sanitized);
  }

  // Escape HTML if no tags are allowed
  if (options.escapeHtml || options.stripTags) {
    sanitized = escapeHtml(sanitized);
  }

  return sanitized.trim();
}

/**
 * Sanitizes plain text input
 */
export function sanitizeText(
  text: string,
  options: {
    maxLength?: number;
    allowNewlines?: boolean;
    allowSpecialChars?: boolean;
    trim?: boolean;
  } = {}
): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let sanitized = text;

  // Apply length limit
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  // Remove or allow newlines
  if (!options.allowNewlines) {
    sanitized = sanitized.replace(/[\r\n]/g, ' ');
  }

  // Remove special characters if not allowed
  if (!options.allowSpecialChars) {
    sanitized = sanitized.replace(/[<>'"&]/g, '');
  }

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Trim if requested (default: true)
  if (options.trim !== false) {
    sanitized = sanitized.trim();
  }

  return sanitized;
}

/**
 * Sanitizes email addresses
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  // Convert to lowercase and trim
  let sanitized = email.toLowerCase().trim();

  // Remove any characters that aren't valid in email addresses
  sanitized = sanitized.replace(/[^a-z0-9@._+-]/g, '');

  // Ensure only one @ symbol
  const atCount = (sanitized.match(/@/g) || []).length;
  if (atCount !== 1) {
    return '';
  }

  return sanitized;
}

/**
 * Sanitizes URLs
 */
export function sanitizeUrl(
  url: string,
  options: {
    allowedProtocols?: string[];
    maxLength?: number;
  } = {}
): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const defaultProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
  const allowedProtocols = options.allowedProtocols || defaultProtocols;

  let sanitized = url.trim();

  // Apply length limit
  if (options.maxLength && sanitized.length > options.maxLength) {
    return '';
  }

  try {
    const urlObj = new URL(sanitized);
    
    // Check if protocol is allowed
    if (!allowedProtocols.includes(urlObj.protocol)) {
      return '';
    }

    // Remove potentially dangerous characters
    sanitized = urlObj.toString();
    
    return sanitized;
  } catch (error) {
    // Invalid URL
    return '';
  }
}

/**
 * Sanitizes file names
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    return '';
  }

  let sanitized = fileName.trim();

  // Remove path separators and dangerous characters
  sanitized = sanitized.replace(/[/\\:*?"<>|]/g, '');

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

  // Limit length
  if (sanitized.length > 255) {
    const extension = sanitized.split('.').pop();
    const name = sanitized.substring(0, 255 - (extension ? extension.length + 1 : 0));
    sanitized = extension ? `${name}.${extension}` : name;
  }

  // Ensure it's not empty after sanitization
  if (!sanitized) {
    sanitized = 'untitled';
  }

  return sanitized;
}

/**
 * Sanitizes SQL-like input to prevent injection
 */
export function sanitizeSqlInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // Remove SQL keywords and dangerous characters
  const sqlKeywords = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
    'EXEC', 'EXECUTE', 'UNION', 'SCRIPT', 'DECLARE', 'CAST', 'CONVERT'
  ];

  const regex = new RegExp(`\\b(${sqlKeywords.join('|')})\\b`, 'gi');
  sanitized = sanitized.replace(regex, '');

  // Remove dangerous SQL characters
  sanitized = sanitized.replace(/[';--/*]|\/\*|\*\/|--/g, '');

  return sanitized.trim();
}

/**
 * Sanitizes JSON input
 */
export function sanitizeJsonInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  try {
    // Parse and stringify to ensure valid JSON
    const parsed = JSON.parse(input);
    return JSON.stringify(parsed);
  } catch (error) {
    return '';
  }
}

/**
 * Sanitizes phone numbers
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Remove all non-digit characters except + at the beginning
  let sanitized = phone.replace(/[^\d+]/g, '');

  // Ensure + is only at the beginning
  if (sanitized.includes('+')) {
    const parts = sanitized.split('+');
    sanitized = '+' + parts.join('');
  }

  return sanitized;
}

/**
 * Removes empty HTML elements
 */
function removeEmptyElements(html: string): string {
  // Remove elements that are empty or contain only whitespace
  return html.replace(/<(\w+)(?:\s[^>]*)?>[\s]*<\/\1>/g, '');
}

/**
 * Escapes HTML characters
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return text.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
}

/**
 * Sanitizes user input based on content type
 */
export function sanitizeUserInput(
  input: string,
  type: 'html' | 'text' | 'email' | 'url' | 'filename' | 'phone' | 'sql' | 'json',
  options?: any
): string {
  switch (type) {
    case 'html':
      return sanitizeHtml(input, options);
    case 'text':
      return sanitizeText(input, options);
    case 'email':
      return sanitizeEmail(input);
    case 'url':
      return sanitizeUrl(input, options);
    case 'filename':
      return sanitizeFileName(input);
    case 'phone':
      return sanitizePhone(input);
    case 'sql':
      return sanitizeSqlInput(input);
    case 'json':
      return sanitizeJsonInput(input);
    default:
      return sanitizeText(input, options);
  }
}

/**
 * Sanitizes an object's string properties
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  config: Record<keyof T, { type: string; options?: any }>
): T {
  const sanitized = { ...obj };

  Object.keys(config).forEach((key) => {
    if (sanitized[key] && typeof sanitized[key] === 'string') {
      const { type, options } = config[key];
      sanitized[key] = sanitizeUserInput(sanitized[key], type as any, options);
    }
  });

  return sanitized;
}

// ====================
// CONTENT SECURITY UTILITIES
// ====================

/**
 * Validates and sanitizes rich text content
 */
export function sanitizeRichTextContent(content: string): {
  sanitized: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  if (!content) {
    return { sanitized: '', warnings };
  }

  // Check for potentially dangerous content
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  dangerousPatterns.forEach((pattern, index) => {
    if (pattern.test(content)) {
      warnings.push(`Potentially dangerous content detected and removed (pattern ${index + 1})`);
    }
  });

  const sanitized = sanitizeHtml(content, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
      'a', 'img', 'code', 'pre', 'span', 'div', 'table',
      'thead', 'tbody', 'tr', 'th', 'td'
    ],
    allowedAttributes: {
      'a': ['href', 'title', 'target'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      'blockquote': ['cite'],
      'table': ['summary'],
      'th': ['scope'],
      'td': ['headers'],
    },
    removeEmptyElements: true,
    maxLength: 50000,
  });

  return { sanitized, warnings };
}

/**
 * Sanitizes learning content before storing in database
 */
export function sanitizeLearningContent(content: {
  title: string;
  description: string;
  content: string;
  tags?: string[];
}): typeof content {
  return {
    title: sanitizeText(content.title, { maxLength: 200, allowSpecialChars: false }),
    description: sanitizeText(content.description, { maxLength: 2000, allowNewlines: true }),
    content: sanitizeRichTextContent(content.content).sanitized,
    tags: content.tags?.map(tag => 
      sanitizeText(tag, { maxLength: 50, allowSpecialChars: false })
    ).filter(tag => tag.length > 0),
  };
}

export default {
  sanitizeHtml,
  sanitizeText,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeFileName,
  sanitizeSqlInput,
  sanitizeJsonInput,
  sanitizePhone,
  sanitizeUserInput,
  sanitizeObject,
  sanitizeRichTextContent,
  sanitizeLearningContent,
};