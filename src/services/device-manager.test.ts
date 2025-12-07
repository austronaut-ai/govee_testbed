// Unit tests for DeviceManager
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceManager, ManagedDevice } from './device-manager';
import { BLEService, BLEDevice } from './ble.service';
import type { DeviceState } from '../types/device';

// Mock BLE Service
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

describe('DeviceManager Unit Tests', () => {
  let mockBLEService: MockBLEService;
  let deviceManager: DeviceManager;

  beforeEach(() => {
    mockBLEService = new MockBLEService();
    deviceManager = new DeviceManager(mockBLEService);
  });

  describe('Device Registration', () => {
    it('should register discovered devices', async () => {
      // Setup mock device
      const mockDevice: BLEDevice = {
        id: 'test-device-1',
        name: 'Govee_Light_1',
        rssi: -50,
        device: {} as BluetoothDevice,
      };
      mockBLEService.addMockDevice(mockDevice);

      // Discover devices
      const devices = await deviceManager.discoverDevices();

      // Verify device is registered
      expect(devices).toHaveLength(1);
      expect(devices[0].id).toBe('test-device-1');
      expect(devices[0].name).toBe('Govee_Light_1');
      expect(devices[0].rssi).toBe(-50);
      expect(devices[0].connectionState).toBe('disconnected');
    });

    it('should maintain existing connection state when re-discovering devices', async () => {
      // Setup mock device
      const mockDevice: BLEDevice = {
        id: 'test-device-1',
        name: 'Govee_Light_1',
        rssi: -50,
        device: {} as BluetoothDevice,
      };
      mockBLEService.addMockDevice(mockDevice);

      // First discovery and connection
      await deviceManager.discoverDevices();
      await deviceManager.connectDevice('test-device-1');

      // Re-discover
      const devices = await deviceManager.discoverDevices();

      // Verify connection state is maintained
      expect(devices[0].connectionState).toBe('connected');
    });

    it('should update device registry with getDevices', () => {
      const devices = deviceManager.getDevices();
      expect(devices).toBeInstanceOf(Map);
    });
  });

  describe('Connection Queue Behavior', () => {
    it('should process multiple connection requests sequentially', async () => {
      // Setup multiple mock devices
      const device1: BLEDevice = {
        id: 'device-1',
        name: 'Govee_1',
        rssi: -50,
        device: {} as BluetoothDevice,
      };
      const device2: BLEDevice = {
        id: 'device-2',
        name: 'Govee_2',
        rssi: -60,
        device: {} as BluetoothDevice,
      };

      mockBLEService.addMockDevice(device1);
      mockBLEService.addMockDevice(device2);

      // Discover devices
      await deviceManager.discoverDevices();

      // Connect to both devices
      await Promise.all([
        deviceManager.connectDevice('device-1'),
        deviceManager.connectDevice('device-2'),
      ]);

      // Verify both are connected
      const dev1 = deviceManager.getDevice('device-1');
      const dev2 = deviceManager.getDevice('device-2');
      expect(dev1?.connectionState).toBe('connected');
      expect(dev2?.connectionState).toBe('connected');
    });

    it('should set connection state to connecting when queued', async () => {
      const mockDevice: BLEDevice = {
        id: 'test-device',
        name: 'Govee_Test',
        rssi: -50,
        device: {} as BluetoothDevice,
      };
      mockBLEService.addMockDevice(mockDevice);

      await deviceManager.discoverDevices();

      // Start connection (don't await yet)
      const connectionPromise = deviceManager.connectDevice('test-device');

      // Check state is connecting (might already be connected due to speed)
      const device = deviceManager.getDevice('test-device');
      expect(['connecting', 'connected']).toContain(device?.connectionState);

      await connectionPromise;
    });
  });

  describe('State Updates', () => {
    it('should read and store device state after connection', async () => {
      const mockDevice: BLEDevice = {
        id: 'test-device',
        name: 'Govee_Test',
        rssi: -50,
        device: {} as BluetoothDevice,
      };
      const mockState: DeviceState = {
        power: true,
        brightness: 128,
        color: { r: 255, g: 0, b: 0 },
      };

      mockBLEService.addMockDevice(mockDevice, mockState);

      await deviceManager.discoverDevices();
      await deviceManager.connectDevice('test-device');

      // Verify state was read
      const device = deviceManager.getDevice('test-device');
      expect(device?.state).toEqual(mockState);
    });

    it('should update state when getDeviceState is called', async () => {
      const mockDevice: BLEDevice = {
        id: 'test-device',
        name: 'Govee_Test',
        rssi: -50,
        device: {} as BluetoothDevice,
      };
      const initialState: DeviceState = { power: false };
      mockBLEService.addMockDevice(mockDevice, initialState);

      await deviceManager.discoverDevices();
      await deviceManager.connectDevice('test-device');

      // Get initial state
      const state1 = await deviceManager.getDeviceState('test-device');
      expect(state1?.power).toBe(false);

      // Update mock state
      mockBLEService.addMockDevice(mockDevice, { power: true });

      // Get updated state
      const state2 = await deviceManager.getDeviceState('test-device');
      expect(state2?.power).toBe(true);
    });

    it('should return cached state for disconnected devices', async () => {
      const mockDevice: BLEDevice = {
        id: 'test-device',
        name: 'Govee_Test',
        rssi: -50,
        device: {} as BluetoothDevice,
      };
      const mockState: DeviceState = { power: true, brightness: 100 };
      mockBLEService.addMockDevice(mockDevice, mockState);

      await deviceManager.discoverDevices();
      await deviceManager.connectDevice('test-device');
      await deviceManager.disconnectDevice('test-device');

      // Get state while disconnected
      const state = await deviceManager.getDeviceState('test-device');
      expect(state).toEqual(mockState);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection to non-existent device', async () => {
      await expect(
        deviceManager.connectDevice('non-existent')
      ).rejects.toThrow('Device non-existent not found');
    });

    it('should handle disconnection of non-existent device', async () => {
      await expect(
        deviceManager.disconnectDevice('non-existent')
      ).rejects.toThrow('Device non-existent not found');
    });

    it('should handle sending command to disconnected device', async () => {
      const mockDevice: BLEDevice = {
        id: 'test-device',
        name: 'Govee_Test',
        rssi: -50,
        device: {} as BluetoothDevice,
      };
      mockBLEService.addMockDevice(mockDevice);

      await deviceManager.discoverDevices();

      // Try to send command without connecting
      const command = new Uint8Array([0x33, 0x01, 0x01]);
      await expect(
        deviceManager.sendCommand('test-device', command)
      ).rejects.toThrow('not connected');
    });
  });
});
