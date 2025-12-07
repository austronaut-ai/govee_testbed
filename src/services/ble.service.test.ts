// Unit tests for BLE Service
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BLEService, BLEError, BLEErrorCode, type BLEDevice } from './ble.service';

describe('BLE Service Unit Tests', () => {
  let bleService: BLEService;

  beforeEach(() => {
    bleService = new BLEService();
  });

  describe('isSupported', () => {
    it('should return true when Web Bluetooth API is available', () => {
      // Mock navigator.bluetooth
      const mockNavigator = {
        bluetooth: {},
      };
      vi.stubGlobal('navigator', mockNavigator);

      expect(bleService.isSupported()).toBe(true);

      vi.unstubAllGlobals();
    });

    it('should return false when Web Bluetooth API is not available', () => {
      // Mock navigator without bluetooth
      const mockNavigator = {};
      vi.stubGlobal('navigator', mockNavigator);

      expect(bleService.isSupported()).toBe(false);

      vi.unstubAllGlobals();
    });
  });

  describe('scanForDevices', () => {
    it('should throw NOT_SUPPORTED error when Web Bluetooth is not available', async () => {
      // Mock navigator without bluetooth
      vi.stubGlobal('navigator', {});

      await expect(bleService.scanForDevices()).rejects.toThrow(BLEError);
      await expect(bleService.scanForDevices()).rejects.toMatchObject({
        code: BLEErrorCode.NOT_SUPPORTED,
        recoverable: false,
      });

      vi.unstubAllGlobals();
    });

    it('should throw USER_CANCELLED error when user cancels device selection', async () => {
      // Mock navigator.bluetooth with requestDevice that throws NotAllowedError
      const error = new Error('User cancelled');
      error.name = 'NotAllowedError';
      const mockBluetooth = {
        requestDevice: vi.fn().mockRejectedValue(error),
      };
      vi.stubGlobal('navigator', { bluetooth: mockBluetooth });

      await expect(bleService.scanForDevices()).rejects.toThrow(BLEError);
      await expect(bleService.scanForDevices()).rejects.toMatchObject({
        code: BLEErrorCode.USER_CANCELLED,
      });

      vi.unstubAllGlobals();
    });

    it('should throw DEVICE_NOT_FOUND error when no devices are found', async () => {
      // Mock navigator.bluetooth with requestDevice that throws NotFoundError
      const mockBluetooth = {
        requestDevice: vi.fn().mockRejectedValue(new DOMException('No devices found', 'NotFoundError')),
      };
      vi.stubGlobal('navigator', { bluetooth: mockBluetooth });

      await expect(bleService.scanForDevices()).rejects.toThrow(BLEError);
      await expect(bleService.scanForDevices()).rejects.toMatchObject({
        code: BLEErrorCode.DEVICE_NOT_FOUND,
      });

      vi.unstubAllGlobals();
    });

    it('should return device array when scan succeeds', async () => {
      // Mock successful device discovery
      const mockDevice = {
        id: 'test-device-id',
        name: 'Govee Test Device',
        gatt: {},
      };
      const mockBluetooth = {
        requestDevice: vi.fn().mockResolvedValue(mockDevice),
      };
      vi.stubGlobal('navigator', { bluetooth: mockBluetooth });

      const devices = await bleService.scanForDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0].id).toBe('test-device-id');
      expect(devices[0].name).toBe('Govee Test Device');
      expect(devices[0].rssi).toBeDefined();
      expect(devices[0].device).toBe(mockDevice);

      vi.unstubAllGlobals();
    });
  });

  describe('connect', () => {
    it('should throw CONNECTION_FAILED error when device has no GATT', async () => {
      const mockDevice: BLEDevice = {
        id: 'test-id',
        name: 'Test Device',
        rssi: -50,
        device: {} as BluetoothDevice, // No gatt property
      };

      await expect(bleService.connect(mockDevice)).rejects.toThrow(BLEError);
      await expect(bleService.connect(mockDevice)).rejects.toMatchObject({
        code: BLEErrorCode.CONNECTION_FAILED,
        deviceId: 'test-id',
      });
    });

    it('should connect successfully and store device', async () => {
      const mockServer = { connected: true };
      const mockGatt = {
        connect: vi.fn().mockResolvedValue(mockServer),
      };
      const mockBluetoothDevice = {
        id: 'test-id',
        name: 'Test Device',
        gatt: mockGatt,
        addEventListener: vi.fn(),
      } as unknown as BluetoothDevice;

      const mockDevice: BLEDevice = {
        id: 'test-id',
        name: 'Test Device',
        rssi: -50,
        device: mockBluetoothDevice,
      };

      await bleService.connect(mockDevice);

      expect(mockGatt.connect).toHaveBeenCalled();
      expect(mockDevice.server).toBe(mockServer);
      expect(bleService.isConnected('test-id')).toBe(true);
    });

    it('should handle connection errors', async () => {
      const mockGatt = {
        connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
      };
      const mockBluetoothDevice = {
        id: 'test-id',
        name: 'Test Device',
        gatt: mockGatt,
        addEventListener: vi.fn(),
      } as unknown as BluetoothDevice;

      const mockDevice: BLEDevice = {
        id: 'test-id',
        name: 'Test Device',
        rssi: -50,
        device: mockBluetoothDevice,
      };

      await expect(bleService.connect(mockDevice)).rejects.toThrow(BLEError);
      await expect(bleService.connect(mockDevice)).rejects.toMatchObject({
        code: BLEErrorCode.CONNECTION_FAILED,
      });
    });
  });

  describe('disconnect', () => {
    it('should disconnect device and clean up resources', async () => {
      const mockDisconnect = vi.fn();
      const mockServer = { connected: true };
      const mockGatt = {
        connect: vi.fn().mockResolvedValue(mockServer),
        disconnect: mockDisconnect,
      };
      const mockBluetoothDevice = {
        id: 'test-id',
        name: 'Test Device',
        gatt: mockGatt,
        addEventListener: vi.fn(),
      } as unknown as BluetoothDevice;

      const mockDevice: BLEDevice = {
        id: 'test-id',
        name: 'Test Device',
        rssi: -50,
        device: mockBluetoothDevice,
      };

      // Connect first
      await bleService.connect(mockDevice);

      await bleService.disconnect(mockDevice);

      expect(mockDisconnect).toHaveBeenCalled();
      expect(bleService.isConnected('test-id')).toBe(false);
    });

    it('should handle disconnection when device is not connected', async () => {
      const mockBluetoothDevice = {
        id: 'test-id',
        name: 'Test Device',
        gatt: {},
      } as unknown as BluetoothDevice;

      const mockDevice: BLEDevice = {
        id: 'test-id',
        name: 'Test Device',
        rssi: -50,
        device: mockBluetoothDevice,
      };

      // Should not throw
      await expect(bleService.disconnect(mockDevice)).resolves.not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false for unknown device', () => {
      expect(bleService.isConnected('unknown-id')).toBe(false);
    });

    it('should return true for connected device', async () => {
      const mockServer = { connected: true };
      const mockGatt = {
        connect: vi.fn().mockResolvedValue(mockServer),
      };
      const mockBluetoothDevice = {
        id: 'test-id',
        name: 'Test Device',
        gatt: mockGatt,
        addEventListener: vi.fn(),
      } as unknown as BluetoothDevice;

      const mockDevice: BLEDevice = {
        id: 'test-id',
        name: 'Test Device',
        rssi: -50,
        device: mockBluetoothDevice,
      };

      await bleService.connect(mockDevice);

      expect(bleService.isConnected('test-id')).toBe(true);
    });
  });
});
