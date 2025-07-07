/**
 * Safe UUID generation utility that works in both browser and server environments
 * Handles strict null checks and provides robust UUID validation
 */

/**
 * UUID format regex for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generate a UUID v4 string
 * @returns A valid UUID v4 string
 */
export function generateUUID(): string {
  // Use crypto.randomUUID if available (Node.js 16.7+ and modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      const uuid = crypto.randomUUID();
      // Validate the generated UUID to ensure it's valid
      if (isValidUUID(uuid)) {
        return uuid;
      }
    } catch (error) {
      // Fall back to manual implementation if crypto.randomUUID fails
      console.warn('crypto.randomUUID failed, falling back to manual implementation:', error);
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
 * @returns The first 8 characters of a UUID
 */
export function generateShortUUID(): string {
  const uuid = generateUUID();
  // Use safe string access with bounds checking
  if (uuid.length >= 8) {
    return uuid.slice(0, 8);
  }
  // Fallback in case of unexpected short UUID
  return uuid;
}

/**
 * Generate a UUID with a specific prefix
 * @param prefix The prefix to add to the UUID
 * @returns A prefixed UUID string
 */
export function generatePrefixedUUID(prefix: string): string {
  // Validate prefix parameter
  if (typeof prefix !== 'string') {
    throw new Error('Prefix must be a string');
  }
  return `${prefix}_${generateUUID()}`;
}

/**
 * Validate if a string is a valid UUID
 * @param uuid The string to validate
 * @returns True if the string is a valid UUID, false otherwise
 */
export function isValidUUID(uuid: string): boolean {
  if (typeof uuid !== 'string') {
    return false;
  }
  return UUID_REGEX.test(uuid);
}

/**
 * Validate UUID and throw error if invalid
 * @param uuid The UUID to validate
 * @throws Error if the UUID is invalid
 */
export function validateUUID(uuid: string): void {
  if (!isValidUUID(uuid)) {
    throw new Error(`Invalid UUID format: ${uuid}`);
  }
}

/**
 * Extract UUID from a prefixed UUID string
 * @param prefixedUUID The prefixed UUID string
 * @returns The UUID part without the prefix, or null if invalid
 */
export function extractUUIDFromPrefixed(prefixedUUID: string): string | null {
  if (typeof prefixedUUID !== 'string') {
    return null;
  }
  
  // Find the last underscore to handle prefixes with underscores
  const lastUnderscoreIndex = prefixedUUID.lastIndexOf('_');
  if (lastUnderscoreIndex === -1) {
    // No underscore found, check if it's a valid UUID itself
    return isValidUUID(prefixedUUID) ? prefixedUUID : null;
  }
  
  // Extract the UUID part after the last underscore
  const uuidPart = prefixedUUID.slice(lastUnderscoreIndex + 1);
  
  // Validate the extracted UUID
  return isValidUUID(uuidPart) ? uuidPart : null;
}

/**
 * Parse UUID from various formats and return normalized UUID
 * @param input The input string that might contain a UUID
 * @returns A valid UUID string or null if no valid UUID found
 */
export function parseUUID(input: string): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  
  // Trim whitespace
  const trimmed = input.trim();
  
  // Check if it's already a valid UUID
  if (isValidUUID(trimmed)) {
    return trimmed;
  }
  
  // Try to extract from prefixed format
  const extracted = extractUUIDFromPrefixed(trimmed);
  if (extracted) {
    return extracted;
  }
  
  // Try to find UUID pattern in the string
  const match = trimmed.match(UUID_REGEX);
  return match ? match[0] : null;
}

/**
 * Generate multiple UUIDs
 * @param count Number of UUIDs to generate
 * @returns Array of UUID strings
 */
export function generateMultipleUUIDs(count: number): string[] {
  if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
    throw new Error('Count must be a non-negative integer');
  }
  
  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    uuids.push(generateUUID());
  }
  return uuids;
}

/**
 * Compare two UUIDs for equality (case-insensitive)
 * @param uuid1 First UUID
 * @param uuid2 Second UUID
 * @returns True if UUIDs are equal, false otherwise
 */
export function compareUUIDs(uuid1: string, uuid2: string): boolean {
  if (typeof uuid1 !== 'string' || typeof uuid2 !== 'string') {
    return false;
  }
  
  return uuid1.toLowerCase() === uuid2.toLowerCase();
}