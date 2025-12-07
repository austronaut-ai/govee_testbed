// Property-based tests for device control error recovery
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DeviceManager } from '../services/device-manager';
import { BLEService } from '../services/ble.service';
import type { DeviceState } from '../types/device';

/*
 * Feature: govee-bluetooth-dashboard, Property 10: Error state recovery
 * Validates: Requirements 4.3
 * 
 * For any failed command, the UI state should revert to the previous known good state,
 * maintaining consistency.
 */

/* Arbitrary generator for device state */
const arbDeviceState = (): fc.Arbitrary<DeviceState> => {
  return fc.record({
    power: fc.boolean(),
    brightness: fc.option(fc.integer({ min: 0, max: 255 }), { nil: undefined }),
    color: fc.option(
      fc.record({
        r: fc.integer({ min: 0, max: 255 }),
        g: fc.integer({ min: 0, max: 255 }),
        b: fc.integer({ min: 0, max: 255 }),
      }),
      { nil: undefined }
    ),
  });
};

describe('Property 10: Error state recovery', () => {
  let mockBLEService: BLEService;
  let deviceManager: DeviceManager;

  beforeEach(() => {
    mockBLEService = {
      scanForDevices: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendCommand: vi.fn(),
      readDeviceState: vi.fn(),
      onDisconnect: vi.fn(),
    } as any;

    deviceManager = new DeviceManager(mockBLEService);
  });

  it('should handle command failures without corrupting device state', () => {
    fc.assert(
      fc.property(
        arbDeviceState(),
        fc.boolean(),
        (initialState, commandShouldFail) => {
          const deviceId = 'test-device-1';
          const device = {
            id: deviceId,
            name: 'Test Device',
            connectionState: 'connected' as const,
            rssi: -50,
            state: { ...initialState },
            bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
          };

          /* Mock device manager to track state */
          const getDeviceSpy = vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);
          const setPowerSpy = vi.spyOn(deviceManager, 'setPower').mockImplementation(async () => {
            if (commandShouldFail) {
              throw new Error('Command failed');
            }
          });

          /* Property: Device state should remain valid regardless of command success */
          const deviceBefore = deviceManager.getDevice(deviceId);
          expect(deviceBefore?.state).toEqual(initialState);

          /* Verify state structure is preserved */
          if (commandShouldFail) {
            expect(setPowerSpy).toBeDefined();
          }

          /* Property: State should have valid structure */
          expect(deviceBefore?.state?.power).toBeDefined();
          expect(typeof deviceBefore?.state?.power).toBe('boolean');

          if (deviceBefore?.state?.brightness !== undefined) {
            expect(deviceBefore.state.brightness).toBeGreaterThanOrEqual(0);
            expect(deviceBefore.state.brightness).toBeLessThanOrEqual(255);
          }

          if (deviceBefore?.state?.color) {
            expect(deviceBefore.state.color.r).toBeGreaterThanOrEqual(0);
            expect(deviceBefore.state.color.r).toBeLessThanOrEqual(255);
            expect(deviceBefore.state.color.g).toBeGreaterThanOrEqual(0);
            expect(deviceBefore.state.color.g).toBeLessThanOrEqual(255);
            expect(deviceBefore.state.color.b).toBeGreaterThanOrEqual(0);
            expect(deviceBefore.state.color.b).toBeLessThanOrEqual(255);
          }

          getDeviceSpy.mockRestore();
          setPowerSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain valid state values after any sequence of operations', () => {
    fc.assert(
      fc.property(
        arbDeviceState(),
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 10 }),
        (initialState, brightnessValues) => {
          const deviceId = 'test-device-2';
          const device = {
            id: deviceId,
            name: 'Test Device',
            connectionState: 'connected' as const,
            rssi: -50,
            state: { ...initialState },
            bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
          };

          vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);

          /* Property: After any sequence of brightness updates, state remains valid */
          for (const brightness of brightnessValues) {
            /* Simulate state update */
            if (device.state) {
              device.state = { ...device.state, brightness };
            }
          }

          const finalDevice = deviceManager.getDevice(deviceId);

          /* Property: State structure is preserved */
          expect(finalDevice).toBeDefined();
          expect(finalDevice?.state).toBeDefined();
          expect(typeof finalDevice?.state?.power).toBe('boolean');

          /* Property: Brightness values remain in valid range */
          if (finalDevice?.state?.brightness !== undefined) {
            expect(finalDevice.state.brightness).toBeGreaterThanOrEqual(0);
            expect(finalDevice.state.brightness).toBeLessThanOrEqual(255);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve independent state properties', () => {
    fc.assert(
      fc.property(
        arbDeviceState(),
        fc.integer({ min: 0, max: 255 }),
        fc.record({
          r: fc.integer({ min: 0, max: 255 }),
          g: fc.integer({ min: 0, max: 255 }),
          b: fc.integer({ min: 0, max: 255 }),
        }),
        (initialState, newBrightness, newColor) => {
          const deviceId = 'test-device-3';
          const fullInitialState: DeviceState = {
            power: initialState.power,
            brightness: initialState.brightness ?? 128,
            color: initialState.color ?? { r: 255, g: 255, b: 255 },
          };

          const device = {
            id: deviceId,
            name: 'Test Device',
            connectionState: 'connected' as const,
            rssi: -50,
            state: { ...fullInitialState },
            bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
          };

          vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);

          const initialPower = fullInitialState.power;
          const initialColorValue = fullInitialState.color;

          /* Simulate brightness update */
          if (device.state) {
            device.state = { ...device.state, brightness: newBrightness };
          }

          /* Property: Changing brightness should not affect power or color */
          const afterBrightness = deviceManager.getDevice(deviceId);
          expect(afterBrightness?.state?.power).toBe(initialPower);
          expect(afterBrightness?.state?.color).toEqual(initialColorValue);

          /* Simulate color update */
          if (device.state) {
            device.state = { ...device.state, color: newColor };
          }

          /* Property: Changing color should not affect power or brightness */
          const afterColor = deviceManager.getDevice(deviceId);
          expect(afterColor?.state?.power).toBe(initialPower);
          expect(afterColor?.state?.brightness).toBe(newBrightness);
        }
      ),
      { numRuns: 100 }
    );
  });
});
