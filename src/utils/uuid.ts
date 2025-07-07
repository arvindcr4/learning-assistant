/**
 * Safe UUID generation utility that works in both browser and server environments
 */

export function generateUUID(): string {
  // Use crypto.randomUUID if available (Node.js 16.7+ and modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (error) {
      // Fall back to manual implementation if crypto.randomUUID fails
    }
  }

  // Fallback implementation using Math.random()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate a short UUID (8 characters) for simple use cases
 */
export function generateShortUUID(): string {
  return generateUUID().slice(0, 8);
}

/**
 * Generate a UUID with a specific prefix
 */
export function generatePrefixedUUID(prefix: string): string {
  return `${prefix}_${generateUUID()}`;
}