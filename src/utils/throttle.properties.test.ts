// Property-based tests for command throttling
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { throttle, createCommandThrottle } from './throttle';

/**
 * Feature: govee-bluetooth-dashboard, Property 7: Command throttling preservation
 * Validates: Requirements 5.2
 * 
 * For any sequence of rapid brightness changes, the throttling mechanism should ensure
 * commands are sent at most once per throttle interval, and the final value should
 * eventually be sent.
 */

describe('Property 7: Command throttling preservation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should throttle rapid calls and preserve final value', () => {
    fc.assert(
      fc.property(
        // Generate array of brightness values (rapid changes)
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 2, maxLength: 20 }),
        fc.integer({ min: 50, max: 200 }), // throttle interval
        (values, interval) => {
          const calls: number[] = [];
          const mockFn = vi.fn((value: number) => {
            calls.push(value);
          });

          const throttled = throttle(mockFn, {
            interval,
            leading: true,
            trailing: true,
          });

          // Send all values rapidly (within 10ms)
          values.forEach((value, index) => {
            vi.advanceTimersByTime(5); // Small delay between calls
            throttled(value);
          });

          // Fast forward past throttle interval to ensure trailing call executes
          vi.advanceTimersByTime(interval + 100);

          // Property 1: At least one call should have been made (leading edge)
          expect(calls.length).toBeGreaterThan(0);

          // Property 2: First call should be the first value (leading edge)
          expect(calls[0]).toBe(values[0]);

          // Property 3: Final value should eventually be sent (trailing edge)
          const finalValue = values[values.length - 1];
          expect(calls[calls.length - 1]).toBe(finalValue);

          // Property 4: Number of calls should be limited (throttled)
          // Maximum calls = 1 (leading) + floor(totalTime / interval) + 1 (trailing)
          const totalTime = values.length * 5;
          const maxExpectedCalls = 1 + Math.floor(totalTime / interval) + 1;
          expect(calls.length).toBeLessThanOrEqual(maxExpectedCalls);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect throttle interval between calls', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 200 }), // throttle interval
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 5, maxLength: 10 }),
        (interval, values) => {
          const callTimes: number[] = [];
          const mockFn = vi.fn(() => {
            callTimes.push(Date.now());
          });

          const throttled = throttle(mockFn, {
            interval,
            leading: true,
            trailing: false, // Only test leading edge timing
          });

          // Send values with enough spacing to trigger multiple leading calls
          values.forEach((value, index) => {
            throttled(value);
            vi.advanceTimersByTime(interval + 10); // Advance past interval
          });

          // Property: Time between consecutive calls should be >= interval
          for (let i = 1; i < callTimes.length; i++) {
            const timeBetweenCalls = callTimes[i] - callTimes[i - 1];
            expect(timeBetweenCalls).toBeGreaterThanOrEqual(interval);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle single call correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 50, max: 200 }),
        (value, interval) => {
          const mockFn = vi.fn();
          const throttled = throttle(mockFn, { interval, leading: true, trailing: true });

          throttled(value);
          vi.advanceTimersByTime(interval + 100);

          // Property: Single call should execute exactly once
          expect(mockFn).toHaveBeenCalledTimes(1);
          expect(mockFn).toHaveBeenCalledWith(value);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('createCommandThrottle should preserve final value', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 3, maxLength: 15 }),
        (values) => {
          const calls: number[] = [];
          const mockFn = vi.fn((value: number) => {
            calls.push(value);
          });

          const throttled = createCommandThrottle(mockFn, 100);

          // Rapid fire all values
          values.forEach((value) => {
            throttled(value);
            vi.advanceTimersByTime(10);
          });

          // Advance to ensure trailing call
          vi.advanceTimersByTime(200);

          // Property: Final value must be preserved
          const finalValue = values[values.length - 1];
          expect(calls).toContain(finalValue);
        }
      ),
      { numRuns: 100 }
    );
  });
});
