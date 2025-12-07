// Unit tests for throttle utility
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { throttle, createCommandThrottle } from './throttle';

describe('throttle utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('throttle', () => {
    it('should execute function immediately on first call (leading edge)', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, { interval: 100, leading: true });

      throttled('test');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('should not execute again within throttle interval', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, { interval: 100, leading: true });

      throttled('first');
      throttled('second');
      throttled('third');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('first');
    });

    it('should execute trailing call after interval', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, { interval: 100, leading: true, trailing: true });

      throttled('first');
      throttled('second');
      throttled('third');

      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith('third');
    });

    it('should allow execution after interval has passed', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, { interval: 100, leading: true });

      throttled('first');
      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      throttled('second');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith('second');
    });

    it('should cancel pending trailing call if new call comes after interval', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, { interval: 100, leading: true, trailing: true });

      throttled('first');
      throttled('second');

      vi.advanceTimersByTime(50);
      throttled('third');

      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith('third');
    });

    it('should work with leading=false', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, { interval: 100, leading: false, trailing: true });

      throttled('first');
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('first');
    });

    it('should work with trailing=false', () => {
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, { interval: 100, leading: true, trailing: false });

      throttled('first');
      throttled('second');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('first');

      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('createCommandThrottle', () => {
    it('should create throttled function with default 100ms interval', () => {
      const mockFn = vi.fn();
      const throttled = createCommandThrottle(mockFn);

      throttled(1);
      throttled(2);
      throttled(3);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(1);

      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith(3);
    });

    it('should accept custom interval', () => {
      const mockFn = vi.fn();
      const throttled = createCommandThrottle(mockFn, 200);

      throttled('a');
      throttled('b');

      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith('b');
    });

    it('should preserve function arguments', () => {
      const mockFn = vi.fn();
      const throttled = createCommandThrottle(mockFn);

      throttled(1, 2, 3);
      expect(mockFn).toHaveBeenCalledWith(1, 2, 3);

      vi.advanceTimersByTime(100);
      throttled('a', 'b', 'c');
      expect(mockFn).toHaveBeenCalledWith('a', 'b', 'c');
    });
  });
});
