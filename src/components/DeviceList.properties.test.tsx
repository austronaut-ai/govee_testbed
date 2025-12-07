// Property-based tests for DeviceList
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DeviceManager } from '../services/device-manager';

import { BLEService } from '../services/ble.service';
import type { BLEDevice } from '../services/ble.service';
import type { DeviceState } from '../types/device';

// Mock BLE Service for property testing
class MockBLEService extends BLEService {
  private mockDevices: Map<string, BLEDevice> = new Map();
  private mockConnected: Set<string> = new Set();
  private mockStates: Map<string, DeviceState> = new Map();

  constructor() {
    super();
  }

  async scanForDevices(): Promise<BLEDevice[]> {
    return Array.from(this.mockDevices.values());
  }

  async connect(bleDevice: BLEDevice): Promise<void> {
    this.mockConnected.add(bleDevice.id);
  }

  async disconnect(bleDevice: BLEDevice): Promise<void> {
    this.mockConnected.delete(bleDevice.id);
  }

  async readDeviceState(bleDevice: BLEDevice): Promise<DeviceState | null> {
    return this.mockStates.get(bleDevice.id) || { power: false };
  }

  async sendCommand(bleDevice: BLEDevice, command: Uint8Array): Promise<void> {
    // Mock command sending - update state based on command
    const currentState = this.mockStates.get(bleDevice.id) || { power: false };
    const newState = { ...currentState };

    // Basic parsing based on command-encoder.ts
    // Byte 0 is 0x33, Byte 1 is CommandType
    if (command.length >= 3 && command[0] === 0x33) {
      const commandType = command[1];

      // Import these enum values if possible, or use hardcoded values matching device.ts
      switch (commandType) {
        case 0x01: // POWER
          newState.power = command[2] === 0x01;
          break;
        case 0x04: // BRIGHTNESS
          newState.brightness = command[2];
          break;
        case 0x05: // COLOR
          if (command.length >= 6) {
            newState.color = {
              r: command[3],
              g: command[4],
              b: command[5]
            };
          }
          break;
      }
    }

    this.mockStates.set(bleDevice.id, newState);
  }

  isConnected(deviceId: string): boolean {
    return this.mockConnected.has(deviceId);
  }

  // Helper methods for testing
  addMockDevice(device: BLEDevice, state?: DeviceState): void {
    this.mockDevices.set(device.id, device);
    if (state) {
      this.mockStates.set(device.id, state);
    }
  }

  clearMockDevices(): void {
    this.mockDevices.clear();
    this.mockConnected.clear();
    this.mockStates.clear();
  }

  getDeviceState(deviceId: string): DeviceState | undefined {
    return this.mockStates.get(deviceId);
  }
}

// Arbitraries for property testing
const arbBLEDevice = (): fc.Arbitrary<BLEDevice> => {
  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 20 }).map(s => `Govee_${s}`),
    rssi: fc.integer({ min: -89, max: -30 }), // Ensure RSSI is within range (> -90) to prevent auto-disconnect
    device: fc.constant({} as BluetoothDevice),
  });
};

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

describe('DeviceList Property Tests', () => {
  /**
   * Feature: govee-bluetooth-dashboard, Property 5: Multi-device independence
   * Validates: Requirements 8.3
   */
  it('Property 5: Multi-device independence - sending a command to one device does not affect other devices', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(arbBLEDevice(), arbDeviceState()), { minLength: 2, maxLength: 5 }),
        async (deviceStatePairs) => {
          // Create fresh instances for each test iteration
          const mockBLEService = new MockBLEService();
          const deviceManager = new DeviceManager(mockBLEService);

          // Setup: Add all devices to mock service with initial states
          for (const [bleDevice, initialState] of deviceStatePairs) {
            mockBLEService.addMockDevice(bleDevice, initialState);
          }

          // Discover all devices
          await deviceManager.discoverDevices();

          // Connect all devices sequentially
          for (const [bleDevice] of deviceStatePairs) {
            await deviceManager.connectDevice(bleDevice.id);
          }

          // Verify all devices are connected before proceeding
          for (const [bleDevice] of deviceStatePairs) {
            const device = deviceManager.getDevice(bleDevice.id);
            expect(device?.connectionState).toBe('connected');
          }

          // Capture initial states of all devices
          const initialStates = new Map<string, DeviceState>();
          for (const [bleDevice] of deviceStatePairs) {
            const device = deviceManager.getDevice(bleDevice.id);
            if (device?.state) {
              initialStates.set(bleDevice.id, { ...device.state });
            }
          }

          // Pick the first device to send a command to
          const [targetDevice] = deviceStatePairs[0];
          const targetDeviceId = targetDevice.id;

          // Send a power command to the target device
          await deviceManager.setPower(targetDeviceId, true);

          // Verify that other devices' states and connection states remain unchanged
          for (const [bleDevice] of deviceStatePairs) {
            if (bleDevice.id !== targetDeviceId) {
              const device = deviceManager.getDevice(bleDevice.id);
              const initialState = initialStates.get(bleDevice.id);

              // Connection state should remain 'connected'
              expect(device?.connectionState).toBe('connected');

              // Device state should be unchanged
              if (initialState && device?.state) {
                expect(device.state.power).toBe(initialState.power);
                expect(device.state.brightness).toBe(initialState.brightness);
                if (initialState.color && device.state.color) {
                  expect(device.state.color.r).toBe(initialState.color.r);
                  expect(device.state.color.g).toBe(initialState.color.g);
                  expect(device.state.color.b).toBe(initialState.color.b);
                }
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
