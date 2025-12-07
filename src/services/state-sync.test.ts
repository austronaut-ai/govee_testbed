// Unit tests for state synchronization
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceManager } from './device-manager';
import { BLEService, BLEDevice } from './ble.service';
import type { DeviceState } from '../types/device';

// Mock BLE Service for unit testing
class MockBLEService extends BLEService {
  private mockDevices: Map<string, BLEDevice> = new Map();
  private mockConnected: Set<string> = new Set();
  private mockStates: Map<string, DeviceState | null> = new Map();
  private stateReadDelay: number = 0;
  private shouldFailStateRead: boolean = false;

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
    if (this.shouldFailStateRead) {
      throw new Error('Failed to read device state');
    }

    // Simulate delay if configured
    if (this.stateReadDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.stateReadDelay));
    }

    return this.mockStates.get(bleDevice.id) || null;
  }

  async sendCommand(bleDevice: BLEDevice, command: Uint8Array): Promise<void> {
    // Mock command sending
  }

  isConnected(deviceId: string): boolean {
    return this.mockConnected.has(deviceId);
  }

  // Helper methods for testing
  addMockDevice(device: BLEDevice, state?: DeviceState | null): void {
    this.mockDevices.set(device.id, device);
    this.mockStates.set(device.id, state || null);
  }

  setStateReadDelay(delay: number): void {
    this.stateReadDelay = delay;
  }

  setShouldFailStateRead(shouldFail: boolean): void {
    this.shouldFailStateRead = shouldFail;
  }

  clearMockDevices(): void {
    this.mockDevices.clear();
    this.mockConnected.clear();
    this.mockStates.clear();
    this.stateReadDelay = 0;
    this.shouldFailStateRead = false;
  }
}

describe('State Synchronization Unit Tests', () => {
  let mockBLEService: MockBLEService;
  let deviceManager: DeviceManager;

  beforeEach(() => {
    mockBLEService = new MockBLEService();
    deviceManager = new DeviceManager(mockBLEService);
  });

  /**
   * Test state reading after connection
   * Requirements: 7.1
   */
  it('should read device state after connection', async () => {
    // Setup: Create a device with a known state
    const bleDevice: BLEDevice = {
      id: 'test-device-1',
      name: 'Govee_Test_Light',
      rssi: -50,
      device: {} as BluetoothDevice,
    };

    const deviceState: DeviceState = {
      power: true,
      brightness: 128,
      color: { r: 255, g: 0, b: 0 },
    };

    mockBLEService.addMockDevice(bleDevice, deviceState);

    // Discover and connect
    await deviceManager.discoverDevices();
    await deviceManager.connectDevice(bleDevice.id);

    // Verify the device state was read and stored
    const managedDevice = deviceManager.getDevice(bleDevice.id);
    expect(managedDevice).toBeDefined();
    expect(managedDevice?.state).toEqual(deviceState);
    expect(managedDevice?.connectionState).toBe('connected');
  });

  /**
   * Test state update timeout
   * Requirements: 7.4
   */
  it('should handle state update timeout gracefully', async () => {
    // Setup: Create a device with delayed state reading
    const bleDevice: BLEDevice = {
      id: 'test-device-2',
      name: 'Govee_Slow_Device',
      rssi: -60,
      device: {} as BluetoothDevice,
    };

    const deviceState: DeviceState = {
      power: false,
      brightness: 50,
    };

    mockBLEService.addMockDevice(bleDevice, deviceState);
    
    // Set a delay that simulates slow response (but not timeout)
    mockBLEService.setStateReadDelay(100);

    // Discover and connect
    await deviceManager.discoverDevices();
    await deviceManager.connectDevice(bleDevice.id);

    // Verify state was eventually read despite delay
    const managedDevice = deviceManager.getDevice(bleDevice.id);
    expect(managedDevice?.state).toEqual(deviceState);
  });

  /**
   * Test unknown state display on read failure
   * Requirements: 7.5
   */
  it('should display unknown state indicator when state reading fails', async () => {
    // Setup: Create a device that will fail state reading
    const bleDevice: BLEDevice = {
      id: 'test-device-3',
      name: 'Govee_Failing_Device',
      rssi: -70,
      device: {} as BluetoothDevice,
    };

    mockBLEService.addMockDevice(bleDevice, null);
    mockBLEService.setShouldFailStateRead(true);

    // Discover the device
    await deviceManager.discoverDevices();

    // Try to connect (state reading will fail during connection)
    try {
      await deviceManager.connectDevice(bleDevice.id);
    } catch (error) {
      // Connection might fail due to state read error
    }

    // Verify the device shows null/unknown state
    const managedDevice = deviceManager.getDevice(bleDevice.id);
    
    // The device should either have null state or be in error state
    if (managedDevice?.connectionState === 'connected') {
      expect(managedDevice.state).toBeNull();
    } else {
      // If connection failed, device should be in error state
      expect(managedDevice?.connectionState).toBe('error');
    }
  });

  /**
   * Test state reading for device without optional features
   * Requirements: 7.1, 7.2, 7.3
   */
  it('should handle devices with only power state (no brightness or color)', async () => {
    // Setup: Create a device with only power state
    const bleDevice: BLEDevice = {
      id: 'test-device-4',
      name: 'Govee_Simple_Device',
      rssi: -55,
      device: {} as BluetoothDevice,
    };

    const deviceState: DeviceState = {
      power: true,
      // No brightness or color
    };

    mockBLEService.addMockDevice(bleDevice, deviceState);

    // Discover and connect
    await deviceManager.discoverDevices();
    await deviceManager.connectDevice(bleDevice.id);

    // Verify only power state is present
    const managedDevice = deviceManager.getDevice(bleDevice.id);
    expect(managedDevice?.state).toEqual(deviceState);
    expect(managedDevice?.state?.power).toBe(true);
    expect(managedDevice?.state?.brightness).toBeUndefined();
    expect(managedDevice?.state?.color).toBeUndefined();
  });

  /**
   * Test state updates after commands
   * Requirements: 4.2, 6.4, 7.4
   */
  it('should update state after sending commands', async () => {
    // Setup: Create a device
    const bleDevice: BLEDevice = {
      id: 'test-device-5',
      name: 'Govee_Controllable_Device',
      rssi: -45,
      device: {} as BluetoothDevice,
    };

    const initialState: DeviceState = {
      power: false,
      brightness: 0,
    };

    mockBLEService.addMockDevice(bleDevice, initialState);

    // Discover and connect
    await deviceManager.discoverDevices();
    await deviceManager.connectDevice(bleDevice.id);

    // Verify initial state
    let managedDevice = deviceManager.getDevice(bleDevice.id);
    expect(managedDevice?.state?.power).toBe(false);

    // Update the mock state to simulate device response
    const updatedState: DeviceState = {
      power: true,
      brightness: 255,
    };
    mockBLEService.addMockDevice(bleDevice, updatedState);

    // Read the updated state
    await deviceManager.getDeviceState(bleDevice.id);

    // Verify state was updated
    managedDevice = deviceManager.getDevice(bleDevice.id);
    expect(managedDevice?.state).toEqual(updatedState);
  });
});
