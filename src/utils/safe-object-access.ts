// Safe Object Access Utilities
// Provides helper functions to prevent undefined object access issues

/**
 * Type guard to check if a value is a non-null object
 */
export function isValidObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a valid number
 */
export function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Type guard to check if a value is a valid non-empty string
 */
export function isValidString(value: any): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a valid Date
 */
export function isValidDate(value: any): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Safely get a nested property from an object with default value
 */
export function safeGet<T>(
  obj: any, 
  path: string | string[], 
  defaultValue: T
): T {
  if (!isValidObject(obj)) {
    return defaultValue;
  }

  const keys = Array.isArray(path) ? path : path.split('.');
  let current = obj;

  for (const key of keys) {
    if (!isValidObject(current) || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }

  return current !== undefined ? (current as T) : defaultValue;
}

/**
 * Safely access array elements with bounds checking
 */
export function safeArrayGet<T>(
  array: any, 
  index: number, 
  defaultValue: T
): T {
  if (!Array.isArray(array) || index < 0 || index >= array.length) {
    return defaultValue;
  }
  
  const value = array[index];
  return value !== undefined ? value : defaultValue;
}

/**
 * Safely parse a number with default value
 */
export function safeParseNumber(value: any, defaultValue: number = 0): number {
  if (isValidNumber(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isValidNumber(parsed) ? parsed : defaultValue;
  }

  return defaultValue;
}

/**
 * Safely parse a date with default value
 */
export function safeParseDate(value: any, defaultValue: Date | null = null): Date | null {
  if (isValidDate(value)) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : defaultValue;
  }

  return defaultValue;
}

/**
 * Safely access object properties used as indices/keys
 * Prevents runtime errors when properties might be undefined
 */
export function safeObjectIndex<T>(
  obj: Record<string, T>,
  key: any,
  defaultValue: T
): T {
  if (!isValidObject(obj) || !isValidString(key)) {
    return defaultValue;
  }

  if (!(key in obj)) {
    return defaultValue;
  }

  const value = obj[key];
  return value !== undefined ? value : defaultValue;
}

/**
 * Safely calculate percentage with division by zero protection
 */
export function safePercentage(
  numerator: any, 
  denominator: any, 
  defaultValue: number = 0
): number {
  const num = safeParseNumber(numerator);
  const den = safeParseNumber(denominator);

  if (den === 0) {
    return defaultValue;
  }

  const result = (num / den) * 100;
  return isValidNumber(result) ? Math.round(result * 100) / 100 : defaultValue;
}

/**
 * Safely calculate average with empty array protection
 */
export function safeAverage(values: any[], defaultValue: number = 0): number {
  if (!Array.isArray(values) || values.length === 0) {
    return defaultValue;
  }

  const validValues = values.filter(isValidNumber);
  if (validValues.length === 0) {
    return defaultValue;
  }

  const sum = validValues.reduce((acc, val) => acc + val, 0);
  const average = sum / validValues.length;
  
  return isValidNumber(average) ? Math.round(average * 100) / 100 : defaultValue;
}

/**
 * Safely access analytics data by date with proper validation
 */
export function safeAnalyticsDataByDate<T>(
  data: Record<string, T>,
  date: any,
  defaultValue: T
): T {
  // Validate the date parameter
  let dateKey: string;

  if (typeof date === 'string') {
    dateKey = date;
  } else if (isValidDate(date)) {
    dateKey = date.toISOString().split('T')[0];
  } else {
    return defaultValue;
  }

  // Ensure data is a valid object
  if (!isValidObject(data)) {
    return defaultValue;
  }

  // Safely access the date key
  return safeObjectIndex(data, dateKey, defaultValue);
}

/**
 * Safely merge objects with undefined property protection
 */
export function safeMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  if (!isValidObject(target)) {
    return {} as T;
  }

  if (!isValidObject(source)) {
    return { ...target };
  }

  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key) && source[key] !== undefined) {
      result[key] = source[key] as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Create a safe iterator for objects that might have undefined properties
 */
export function* safeObjectEntries<T>(
  obj: Record<string, T>
): Generator<[string, T], void, unknown> {
  if (!isValidObject(obj)) {
    return;
  }

  for (const key in obj) {
    if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
      yield [key, obj[key]];
    }
  }
}

/**
 * Validate session data structure to prevent undefined access
 */
export interface ValidSession {
  id?: string;
  startTime: Date;
  duration: number;
  totalQuestions: number;
  correctAnswers: number;
  completed: boolean;
  engagementMetrics: {
    focusTime: number;
    interactionRate: number;
    distractionEvents: number;
  };
}

export function validateSessionData(session: any): session is ValidSession {
  if (!isValidObject(session)) {
    return false;
  }

  return (
    (session.id === undefined || isValidString(session.id)) &&
    isValidDate(session.startTime) &&
    isValidNumber(session.duration) &&
    isValidNumber(session.totalQuestions) &&
    isValidNumber(session.correctAnswers) &&
    typeof session.completed === 'boolean' &&
    isValidObject(session.engagementMetrics) &&
    isValidNumber(session.engagementMetrics.focusTime) &&
    isValidNumber(session.engagementMetrics.interactionRate) &&
    isValidNumber(session.engagementMetrics.distractionEvents)
  );
}

/**
 * Safely extract metrics from session with comprehensive validation
 */
export function extractSafeSessionMetrics(session: any): {
  accuracy: number;
  speed: number;
  engagement: number;
  isValid: boolean;
} {
  const defaultMetrics = {
    accuracy: 0,
    speed: 0,
    engagement: 0,
    isValid: false
  };

  if (!validateSessionData(session)) {
    return defaultMetrics;
  }

  const accuracy = safePercentage(session.correctAnswers, session.totalQuestions);
  const speed = session.duration > 0 ? session.totalQuestions / (session.duration / 60) : 0;
  const engagement = safePercentage(session.engagementMetrics.focusTime, session.duration);

  return {
    accuracy,
    speed,
    engagement,
    isValid: true
  };
}

/**
 * Safe array aggregation functions
 */
export const safeAggregation = {
  sum: (values: any[]): number => {
    const validValues = Array.isArray(values) ? values.filter(isValidNumber) : [];
    return validValues.reduce((sum, val) => sum + val, 0);
  },

  max: (values: any[]): number => {
    const validValues = Array.isArray(values) ? values.filter(isValidNumber) : [];
    return validValues.length > 0 ? Math.max(...validValues) : 0;
  },

  min: (values: any[]): number => {
    const validValues = Array.isArray(values) ? values.filter(isValidNumber) : [];
    return validValues.length > 0 ? Math.min(...validValues) : 0;
  },

  count: (values: any[]): number => {
    return Array.isArray(values) ? values.filter(v => v !== undefined && v !== null).length : 0;
  }
};