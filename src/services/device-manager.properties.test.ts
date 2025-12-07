// Property-based tests for DeviceManager
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DeviceManager } from './device-manager';

import { BLEService } from './ble.service';
import type { BLEDevice } from './ble.service';
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

describe('DeviceManager Property Tests', () => {
  /**
   * Feature: govee-bluetooth-dashboard, Property 2: Connection state consistency
   * Validates: Requirements 2.4, 3.2
   */
  it('Property 2: Connection state consistency - after successful connection, state is connected; after disconnection, state is disconnected', async () => {
    await fc.assert(
      fc.asyncProperty(arbBLEDevice(), async (bleDevice) => {
        // Create fresh instances for each test iteration
        const mockBLEService = new MockBLEService();
        const deviceManager = new DeviceManager(mockBLEService);

        // Setup: Add device to mock service with a default state
        mockBLEService.addMockDevice(bleDevice, { power: false });

        // Discover the device
        await deviceManager.discoverDevices();

        // Connect to device and wait for completion
        await deviceManager.connectDevice(bleDevice.id);

        // Check connection state is 'connected'
        const deviceAfterConnect = deviceManager.getDevice(bleDevice.id);
        expect(deviceAfterConnect?.connectionState).toBe('connected');

        // Disconnect from device
        await deviceManager.disconnectDevice(bleDevice.id);

        // Check connection state is 'disconnected'
        const deviceAfterDisconnect = deviceManager.getDevice(bleDevice.id);
        expect(deviceAfterDisconnect?.connectionState).toBe('disconnected');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: govee-bluetooth-dashboard, Property 8: Connection queue ordering
   * Validates: Requirements 2.5
   */
  it('Property 8: Connection queue ordering - connection requests are processed in FIFO order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbBLEDevice(), { minLength: 2, maxLength: 5 }),
        async (bleDevices) => {
          // Create fresh instances for each test iteration
          const mockBLEService = new MockBLEService();
          const deviceManager = new DeviceManager(mockBLEService);

          // Setup: Add all devices to mock service with default states
          for (const device of bleDevices) {
            mockBLEService.addMockDevice(device, { power: false });
          }

          // Discover all devices
          await deviceManager.discoverDevices();

          // Track connection order
          const connectionOrder: string[] = [];
          const originalConnect = mockBLEService.connect.bind(mockBLEService);

          // Override connect to track order
          mockBLEService.connect = async (bleDevice: BLEDevice) => {
            connectionOrder.push(bleDevice.id);
            await originalConnect(bleDevice);
          };

          // Request connections for all devices simultaneously
          const connectionPromises = bleDevices.map(device =>
            deviceManager.connectDevice(device.id)
          );

          // Wait for all connections to complete
          await Promise.all(connectionPromises);

          // Verify connection order matches request order (FIFO)
          const requestOrder = bleDevices.map(d => d.id);
          expect(connectionOrder).toEqual(requestOrder);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: govee-bluetooth-dashboard, Property 9: Disconnection cleanup
   * Validates: Requirements 3.4
   */
  it('Property 9: Disconnection cleanup - all resources are released after disconnection', async () => {
    await fc.assert(
      fc.asyncProperty(arbBLEDevice(), async (bleDevice) => {
        // Create fresh instances for each test iteration
        const mockBLEService = new MockBLEService();
        const deviceManager = new DeviceManager(mockBLEService);

        // Setup: Add device to mock service with a default state
        mockBLEService.addMockDevice(bleDevice, { power: false });

        // Discover and connect
        await deviceManager.discoverDevices();
        await deviceManager.connectDevice(bleDevice.id);

        // Verify device is connected before disconnection
        expect(mockBLEService.isConnected(bleDevice.id)).toBe(true);
        const deviceBeforeDisconnect = deviceManager.getDevice(bleDevice.id);
        expect(deviceBeforeDisconnect?.connectionState).toBe('connected');

        // Disconnect
        await deviceManager.disconnectDevice(bleDevice.id);

        // Verify device is no longer connected (resources cleaned up)
        expect(mockBLEService.isConnected(bleDevice.id)).toBe(false);

        // Verify device state is disconnected
        const device = deviceManager.getDevice(bleDevice.id);
        expect(device?.connectionState).toBe('disconnected');
      }),
      { numRuns: 100 }
    );
  });
});
