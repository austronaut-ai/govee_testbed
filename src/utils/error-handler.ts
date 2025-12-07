// Error handling and recovery utilities
import { BLEError, BLEErrorCode } from '../services/ble.service';

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
};

/**
 * Check if an error is transient and can be retried
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof BLEError) {
    // Transient errors that can be retried
    return (
      error.code === BLEErrorCode.TIMEOUT ||
      error.code === BLEErrorCode.CONNECTION_FAILED ||
      error.code === BLEErrorCode.COMMAND_FAILED
    );
  }
  return false;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof BLEError) {
    switch (error.code) {
      case BLEErrorCode.NOT_SUPPORTED:
        return 'Your browser does not support Bluetooth. Please use Chrome, Edge, or Opera.';
      case BLEErrorCode.USER_CANCELLED:
        return 'Device selection was cancelled. Please try again.';
      case BLEErrorCode.DEVICE_NOT_FOUND:
        return 'No Govee devices found. Make sure your device is powered on and nearby.';
      case BLEErrorCode.CONNECTION_FAILED:
        return `Failed to connect to device. ${error.deviceId ? `Device: ${error.deviceId}` : 'Please try again.'}`;
      case BLEErrorCode.COMMAND_FAILED:
        return 'Failed to send command to device. Please check the connection and try again.';
      case BLEErrorCode.TIMEOUT:
        return 'Operation timed out. The device may be out of range or not responding.';
      case BLEErrorCode.CHARACTERISTIC_NOT_FOUND:
        return 'Device does not support this feature.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred.';
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: unknown;
  let delay = config.delayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry if error is not transient
      if (!isTransientError(error)) {
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt === config.maxAttempts) {
        throw error;
      }

      // Wait before retrying with exponential backoff
      await sleep(delay);
      delay *= config.backoffMultiplier;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check browser compatibility for Web Bluetooth
 */
export interface BrowserCompatibility {
  isSupported: boolean;
  browserName: string;
  recommendation?: string;
}

export function checkBrowserCompatibility(): BrowserCompatibility {
  // Check if Web Bluetooth API is available
  const isSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  // Detect browser
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let browserName = 'Unknown';
  let recommendation: string | undefined;

  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browserName = 'Chrome';
  } else if (userAgent.includes('Edg')) {
    browserName = 'Edge';
  } else if (userAgent.includes('OPR') || userAgent.includes('Opera')) {
    browserName = 'Opera';
  } else if (userAgent.includes('Firefox')) {
    browserName = 'Firefox';
    recommendation = 'Web Bluetooth is not supported in Firefox. Please use Chrome, Edge, or Opera.';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browserName = 'Safari';
    recommendation = 'Web Bluetooth is not supported in Safari. Please use Chrome, Edge, or Opera.';
  }

  if (!isSupported && !recommendation) {
    recommendation = 'Your browser does not support Web Bluetooth. Please use Chrome, Edge, or Opera.';
  }

  return {
    isSupported,
    browserName,
    recommendation,
  };
}

/**
 * Graceful degradation wrapper
 * Executes operation and returns result or fallback value on error
 */
export async function withGracefulDegradation<T>(
  operation: () => Promise<T>,
  fallback: T,
  onError?: (error: unknown) => void
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (onError) {
      onError(error);
    }
    return fallback;
  }
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  shouldRetry: boolean;
  retryConfig?: RetryConfig;
  fallbackValue?: unknown;
  userMessage: string;
}

/**
 * Determine error recovery strategy
 */
export function getErrorRecoveryStrategy(error: unknown): ErrorRecoveryStrategy {
  if (error instanceof BLEError) {
    const userMessage = getUserFriendlyErrorMessage(error);

    switch (error.code) {
      case BLEErrorCode.NOT_SUPPORTED:
        return {
          shouldRetry: false,
          userMessage,
        };

      case BLEErrorCode.USER_CANCELLED:
        return {
          shouldRetry: false,
          userMessage,
        };

      case BLEErrorCode.DEVICE_NOT_FOUND:
        return {
          shouldRetry: false,
          userMessage,
        };

      case BLEErrorCode.CONNECTION_FAILED:
        return {
          shouldRetry: error.recoverable,
          retryConfig: DEFAULT_RETRY_CONFIG,
          userMessage,
        };

      case BLEErrorCode.COMMAND_FAILED:
        return {
          shouldRetry: error.recoverable,
          retryConfig: {
            maxAttempts: 2,
            delayMs: 500,
            backoffMultiplier: 2,
          },
          userMessage,
        };

      case BLEErrorCode.TIMEOUT:
        return {
          shouldRetry: true,
          retryConfig: {
            maxAttempts: 2,
            delayMs: 1000,
            backoffMultiplier: 1.5,
          },
          userMessage,
        };

      case BLEErrorCode.CHARACTERISTIC_NOT_FOUND:
        return {
          shouldRetry: false,
          userMessage,
        };

      default:
        return {
          shouldRetry: false,
          userMessage,
        };
    }
  }

  return {
    shouldRetry: false,
    userMessage: getUserFriendlyErrorMessage(error),
  };
}
