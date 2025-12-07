// Unit tests for error handling utilities
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isTransientError,
  getUserFriendlyErrorMessage,
  retryOperation,
  checkBrowserCompatibility,
  withGracefulDegradation,
  getErrorRecoveryStrategy,
  DEFAULT_RETRY_CONFIG,
} from './error-handler';
import { BLEError, BLEErrorCode } from '../services/ble.service';

describe('Error Handler', () => {
  describe('isTransientError', () => {
    it('should identify transient BLE errors', () => {
      const timeoutError = new BLEError('Timeout', BLEErrorCode.TIMEOUT);
      const connectionError = new BLEError('Connection failed', BLEErrorCode.CONNECTION_FAILED);
      const commandError = new BLEError('Command failed', BLEErrorCode.COMMAND_FAILED);

      expect(isTransientError(timeoutError)).toBe(true);
      expect(isTransientError(connectionError)).toBe(true);
      expect(isTransientError(commandError)).toBe(true);
    });

    it('should identify non-transient BLE errors', () => {
      const notSupportedError = new BLEError('Not supported', BLEErrorCode.NOT_SUPPORTED);
      const userCancelledError = new BLEError('User cancelled', BLEErrorCode.USER_CANCELLED);
      const deviceNotFoundError = new BLEError('Device not found', BLEErrorCode.DEVICE_NOT_FOUND);

      expect(isTransientError(notSupportedError)).toBe(false);
      expect(isTransientError(userCancelledError)).toBe(false);
      expect(isTransientError(deviceNotFoundError)).toBe(false);
    });

    it('should return false for non-BLE errors', () => {
      const genericError = new Error('Generic error');
      expect(isTransientError(genericError)).toBe(false);
      expect(isTransientError('string error')).toBe(false);
      expect(isTransientError(null)).toBe(false);
    });
  });

  describe('getUserFriendlyErrorMessage', () => {
    it('should return user-friendly message for NOT_SUPPORTED error', () => {
      const error = new BLEError('Not supported', BLEErrorCode.NOT_SUPPORTED);
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toContain('browser does not support Bluetooth');
      expect(message).toContain('Chrome, Edge, or Opera');
    });

    it('should return user-friendly message for USER_CANCELLED error', () => {
      const error = new BLEError('Cancelled', BLEErrorCode.USER_CANCELLED);
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toContain('cancelled');
      expect(message).toContain('try again');
    });

    it('should return user-friendly message for DEVICE_NOT_FOUND error', () => {
      const error = new BLEError('Not found', BLEErrorCode.DEVICE_NOT_FOUND);
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toContain('No Govee devices found');
      expect(message).toContain('powered on');
    });

    it('should return user-friendly message for CONNECTION_FAILED error', () => {
      const error = new BLEError('Connection failed', BLEErrorCode.CONNECTION_FAILED, 'device-123');
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toContain('Failed to connect');
      expect(message).toContain('device-123');
    });

    it('should return user-friendly message for COMMAND_FAILED error', () => {
      const error = new BLEError('Command failed', BLEErrorCode.COMMAND_FAILED);
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toContain('Failed to send command');
      expect(message).toContain('check the connection');
    });

    it('should return user-friendly message for TIMEOUT error', () => {
      const error = new BLEError('Timeout', BLEErrorCode.TIMEOUT);
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toContain('timed out');
      expect(message).toContain('out of range');
    });

    it('should return user-friendly message for CHARACTERISTIC_NOT_FOUND error', () => {
      const error = new BLEError('Characteristic not found', BLEErrorCode.CHARACTERISTIC_NOT_FOUND);
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toContain('does not support this feature');
    });

    it('should handle generic Error objects', () => {
      const error = new Error('Generic error message');
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe('Generic error message');
    });

    it('should handle unknown error types', () => {
      const message = getUserFriendlyErrorMessage('string error');
      expect(message).toBe('An unknown error occurred.');
    });
  });

  describe('retryOperation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const promise = retryOperation(operation);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry transient errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new BLEError('Timeout', BLEErrorCode.TIMEOUT))
        .mockResolvedValueOnce('success');

      const promise = retryOperation(operation, {
        maxAttempts: 3,
        delayMs: 1000,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-transient errors', async () => {
      const error = new BLEError('Not supported', BLEErrorCode.NOT_SUPPORTED);
      const operation = vi.fn().mockRejectedValue(error);

      const promise = retryOperation(operation);

      await expect(promise).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw after max attempts', async () => {
      const error = new BLEError('Timeout', BLEErrorCode.TIMEOUT);
      const operation = vi.fn().mockRejectedValue(error);

      const promise = retryOperation(operation, {
        maxAttempts: 3,
        delayMs: 100,
        backoffMultiplier: 2,
      });

      // Run timers and catch the rejection
      const runTimersPromise = vi.runAllTimersAsync();
      
      await expect(promise).rejects.toThrow(error);
      await runTimersPromise;
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new BLEError('Timeout', BLEErrorCode.TIMEOUT))
        .mockRejectedValueOnce(new BLEError('Timeout', BLEErrorCode.TIMEOUT))
        .mockResolvedValueOnce('success');

      const promise = retryOperation(operation, {
        maxAttempts: 3,
        delayMs: 1000,
        backoffMultiplier: 2,
      });

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // Wait for first retry delay (1000ms)
      await vi.advanceTimersByTimeAsync(1000);
      expect(operation).toHaveBeenCalledTimes(2);

      // Wait for second retry delay (2000ms - exponential backoff)
      await vi.advanceTimersByTimeAsync(2000);
      expect(operation).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });
  });

  describe('checkBrowserCompatibility', () => {
    it('should detect Chrome browser', () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        configurable: true,
      });

      const result = checkBrowserCompatibility();
      expect(result.browserName).toBe('Chrome');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
    });

    it('should detect Edge browser', () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        configurable: true,
      });

      const result = checkBrowserCompatibility();
      expect(result.browserName).toBe('Edge');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
    });

    it('should provide recommendation for Firefox', () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        configurable: true,
      });

      const result = checkBrowserCompatibility();
      expect(result.browserName).toBe('Firefox');
      expect(result.recommendation).toContain('not supported in Firefox');
      expect(result.recommendation).toContain('Chrome, Edge, or Opera');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
    });

    it('should provide recommendation for Safari', () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        configurable: true,
      });

      const result = checkBrowserCompatibility();
      expect(result.browserName).toBe('Safari');
      expect(result.recommendation).toContain('not supported in Safari');

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
    });
  });

  describe('withGracefulDegradation', () => {
    it('should return operation result on success', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await withGracefulDegradation(operation, 'fallback');
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should return fallback value on error', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Failed'));
      const result = await withGracefulDegradation(operation, 'fallback');
      
      expect(result).toBe('fallback');
    });

    it('should call onError callback when error occurs', async () => {
      const error = new Error('Failed');
      const operation = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();
      
      await withGracefulDegradation(operation, 'fallback', onError);
      
      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should not call onError callback on success', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const onError = vi.fn();
      
      await withGracefulDegradation(operation, 'fallback', onError);
      
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('getErrorRecoveryStrategy', () => {
    it('should not retry NOT_SUPPORTED errors', () => {
      const error = new BLEError('Not supported', BLEErrorCode.NOT_SUPPORTED);
      const strategy = getErrorRecoveryStrategy(error);
      
      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.userMessage).toContain('browser does not support Bluetooth');
    });

    it('should not retry USER_CANCELLED errors', () => {
      const error = new BLEError('Cancelled', BLEErrorCode.USER_CANCELLED);
      const strategy = getErrorRecoveryStrategy(error);
      
      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.userMessage).toContain('cancelled');
    });

    it('should retry CONNECTION_FAILED errors if recoverable', () => {
      const error = new BLEError('Connection failed', BLEErrorCode.CONNECTION_FAILED, 'device-123', true);
      const strategy = getErrorRecoveryStrategy(error);
      
      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.retryConfig).toBeDefined();
      expect(strategy.retryConfig?.maxAttempts).toBe(DEFAULT_RETRY_CONFIG.maxAttempts);
    });

    it('should not retry CONNECTION_FAILED errors if not recoverable', () => {
      const error = new BLEError('Connection failed', BLEErrorCode.CONNECTION_FAILED, 'device-123', false);
      const strategy = getErrorRecoveryStrategy(error);
      
      expect(strategy.shouldRetry).toBe(false);
    });

    it('should retry COMMAND_FAILED errors with shorter config', () => {
      const error = new BLEError('Command failed', BLEErrorCode.COMMAND_FAILED, 'device-123', true);
      const strategy = getErrorRecoveryStrategy(error);
      
      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.retryConfig).toBeDefined();
      expect(strategy.retryConfig?.maxAttempts).toBe(2);
      expect(strategy.retryConfig?.delayMs).toBe(500);
    });

    it('should retry TIMEOUT errors', () => {
      const error = new BLEError('Timeout', BLEErrorCode.TIMEOUT);
      const strategy = getErrorRecoveryStrategy(error);
      
      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.retryConfig).toBeDefined();
      expect(strategy.retryConfig?.maxAttempts).toBe(2);
    });

    it('should not retry CHARACTERISTIC_NOT_FOUND errors', () => {
      const error = new BLEError('Characteristic not found', BLEErrorCode.CHARACTERISTIC_NOT_FOUND);
      const strategy = getErrorRecoveryStrategy(error);
      
      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.userMessage).toContain('does not support this feature');
    });

    it('should handle non-BLE errors', () => {
      const error = new Error('Generic error');
      const strategy = getErrorRecoveryStrategy(error);
      
      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.userMessage).toBe('Generic error');
    });
  });
});
