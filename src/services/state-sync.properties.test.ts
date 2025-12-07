// Property-based tests for state synchronization
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DeviceManager } from './device-manager';
import { BLEService } from './ble.service';
import type { BLEDevice } from './ble.service';
import type { DeviceState, RGB } from '../types/device';

// Mock BLE Service for state synchronization testing
class MockBLEService extends BLEService {
  private mockDevices: Map<string, BLEDevice> = new Map();
  private mockConnected: Set<string> = new Set();
  private mockStates: Map<string, DeviceState> = new Map();
  private stateReadCalls: Map<string, number> = new Map();

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
    // Track state read calls
    const currentCount = this.stateReadCalls.get(bleDevice.id) || 0;
    this.stateReadCalls.set(bleDevice.id, currentCount + 1);

    return this.mockStates.get(bleDevice.id) || null;
  }

  async sendCommand(bleDevice: BLEDevice, command: Uint8Array): Promise<void> {
    // Mock command sending
    void bleDevice;
    void command;
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
    this.stateReadCalls.clear();
  }

  getStateReadCount(deviceId: string): number {
    return this.stateReadCalls.get(deviceId) || 0;
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

const arbRGB = (): fc.Arbitrary<RGB> => {
  return fc.record({
    r: fc.integer({ min: 0, max: 255 }),
    g: fc.integer({ min: 0, max: 255 }),
    b: fc.integer({ min: 0, max: 255 }),
  });
};

const arbDeviceState = (): fc.Arbitrary<DeviceState> => {
  return fc.record({
    power: fc.boolean(),
    brightness: fc.option(fc.integer({ min: 0, max: 255 }), { nil: undefined }),
    color: fc.option(arbRGB(), { nil: undefined }),
  });
};

describe('State Synchronization Property Tests', () => {
  /**
   * Feature: govee-bluetooth-dashboard, Property 11: Device state reading completeness
   * Validates: Requirements 7.1, 7.2, 7.3
   */
  it('Property 11: Device state reading completeness - all supported state properties are read after connection', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbBLEDevice(),
        arbDeviceState(),
        async (bleDevice, deviceState) => {
          // Create fresh instances for each test iteration
          const mockBLEService = new MockBLEService();
          const deviceManager = new DeviceManager(mockBLEService);

          // Setup: Add device with state to mock service
          mockBLEService.addMockDevice(bleDevice, deviceState);

          // Discover the device
          await deviceManager.discoverDevices();

          // Connect to device (should trigger state reading)
          await deviceManager.connectDevice(bleDevice.id);

          // Verify state was read at least once during connection
          expect(mockBLEService.getStateReadCount(bleDevice.id)).toBeGreaterThanOrEqual(1);

          // Get the device from manager
          const managedDevice = deviceManager.getDevice(bleDevice.id);
          expect(managedDevice).toBeDefined();

          // Verify all supported state properties are present
          if (managedDevice?.state) {
            // Power state should always be present (Requirement 7.1)
            expect(managedDevice.state).toHaveProperty('power');
            expect(typeof managedDevice.state.power).toBe('boolean');

            // If device supports brightness, it should be read (Requirement 7.2)
            if (deviceState.brightness !== undefined) {
              expect(managedDevice.state.brightness).toBe(deviceState.brightness);
            }

            // If device supports color, it should be read (Requirement 7.3)
            if (deviceState.color !== undefined) {
              expect(managedDevice.state.color).toEqual(deviceState.color);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: govee-bluetooth-dashboard, Property 6: State update propagation
   * Validates: Requirements 4.2, 6.4, 7.4
   */
  it('Property 6: State update propagation - device state changes are reflected in the manager within timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbBLEDevice(),
        arbDeviceState(),
        async (bleDevice, initialState) => {
          // Create fresh instances for each test iteration
          const mockBLEService = new MockBLEService();
          const deviceManager = new DeviceManager(mockBLEService);

          // Setup: Add device with initial state
          mockBLEService.addMockDevice(bleDevice, initialState);

          // Discover and connect
          await deviceManager.discoverDevices();
          await deviceManager.connectDevice(bleDevice.id);

          // Verify initial state is set
          let managedDevice = deviceManager.getDevice(bleDevice.id);
          expect(managedDevice?.state).toEqual(initialState);

          // Create an updated state by modifying the initial state
          const updatedState: DeviceState = {
            power: !initialState.power, // Toggle power
            brightness: initialState.brightness !== undefined ? (initialState.brightness + 50) % 256 : undefined,
            color: initialState.color !== undefined
              ? { r: (initialState.color.r + 100) % 256, g: initialState.color.g, b: initialState.color.b }
              : undefined,
          };

          // Update the mock state
          mockBLEService.addMockDevice(bleDevice, updatedState);

          // Read the updated state (simulating state update propagation)
          const newState = await deviceManager.getDeviceState(bleDevice.id);

          // Verify the new state matches the updated state
          expect(newState).toEqual(updatedState);

          // Verify the manager's internal state is updated
          managedDevice = deviceManager.getDevice(bleDevice.id);
          expect(managedDevice?.state).toEqual(updatedState);
        }
      ),
      { numRuns: 100 }
    );
  });
});
