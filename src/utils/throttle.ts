// Command throttling utility for rate-limiting device commands

export interface ThrottleOptions {
  interval: number; // Minimum time between calls in milliseconds
  leading?: boolean; // Execute on leading edge (default: true)
  trailing?: boolean; // Execute on trailing edge (default: true)
}

interface ThrottledState {
  lastCallTime: number;
  timeoutId: ReturnType<typeof setTimeout> | null;
  lastArgs: any[] | null;
}

/**
 * Creates a throttled function that only invokes the provided function
 * at most once per specified interval.
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  options: ThrottleOptions
): (...args: Parameters<T>) => void {
  const { interval, leading = true, trailing = true } = options;

  const state: ThrottledState = {
    lastCallTime: 0,
    timeoutId: null,
    lastArgs: null,
  };

  return function throttled(...args: Parameters<T>): void {
    const now = Date.now();
    const timeSinceLastCall = now - state.lastCallTime;

    // Clear any pending trailing call
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }

    // Store args for potential trailing call
    state.lastArgs = args;

    // If enough time has passed, execute immediately (leading edge)
    if (timeSinceLastCall >= interval || state.lastCallTime === 0) {
      if (leading) {
        state.lastCallTime = now;
        func(...args);
        state.lastArgs = null;
      } else if (trailing) {
        // If leading is false, schedule trailing call
        state.lastCallTime = now;
        state.timeoutId = setTimeout(() => {
          if (state.lastArgs) {
            func(...state.lastArgs);
            state.lastArgs = null;
          }
          state.timeoutId = null;
        }, interval);
      }
    } else if (trailing) {
      // Schedule trailing call
      const remainingTime = interval - timeSinceLastCall;
      state.timeoutId = setTimeout(() => {
        state.lastCallTime = Date.now();
        if (state.lastArgs) {
          func(...state.lastArgs);
          state.lastArgs = null;
        }
        state.timeoutId = null;
      }, remainingTime);
    }
  };
}

/**
 * Creates a throttled function specifically for device commands
 * Default interval: 100ms (10 commands per second max)
 */
export function createCommandThrottle<T extends (...args: any[]) => any>(
  func: T,
  interval: number = 100
): (...args: Parameters<T>) => void {
  return throttle(func, {
    interval,
    leading: true,
    trailing: true,
  });
}
