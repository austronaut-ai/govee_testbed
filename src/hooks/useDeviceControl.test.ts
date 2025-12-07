// Unit tests for device control handlers
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceManager } from '../services/device-manager';
import { BLEService } from '../services/ble.service';
import type { DeviceState } from '../types/device';

describe('Device Control Handlers', () => {
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

  describe('Power Toggle', () => {
    it('should toggle power from off to on', async () => {
      const deviceId = 'test-device';
      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'connected' as const,
        rssi: -50,
        state: { power: false } as DeviceState,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);
      const setPowerSpy = vi.spyOn(deviceManager, 'setPower').mockResolvedValue();
      const getStateSpy = vi.spyOn(deviceManager, 'getDeviceState').mockResolvedValue({
        power: true,
      });

      await deviceManager.setPower(deviceId, true);

      expect(setPowerSpy).toHaveBeenCalledWith(deviceId, true);
    });

    it('should toggle power from on to off', async () => {
      const deviceId = 'test-device';
      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'connected' as const,
        rssi: -50,
        state: { power: true } as DeviceState,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);
      const setPowerSpy = vi.spyOn(deviceManager, 'setPower').mockResolvedValue();

      await deviceManager.setPower(deviceId, false);

      expect(setPowerSpy).toHaveBeenCalledWith(deviceId, false);
    });

    it('should throw error when device not found', async () => {
      vi.spyOn(deviceManager, 'getDevice').mockReturnValue(undefined);

      await expect(deviceManager.setPower('nonexistent', true)).rejects.toThrow();
    });

    it('should throw error when device not connected', async () => {
      const deviceId = 'test-device';

      /* Setup device in manager's internal map */
      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'disconnected' as const,
        rssi: -50,
        state: null,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      /* Access internal devices map to set up test state */
      (deviceManager as any).devices.set(deviceId, device);

      await expect(deviceManager.setPower(deviceId, true)).rejects.toThrow(
        'not connected'
      );
    });
  });

  describe('Brightness Control', () => {
    it('should send brightness command with valid value', async () => {
      const deviceId = 'test-device';
      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'connected' as const,
        rssi: -50,
        state: { power: true, brightness: 128 } as DeviceState,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);
      const setBrightnessSpy = vi.spyOn(deviceManager, 'setBrightness').mockResolvedValue();

      await deviceManager.setBrightness(deviceId, 200);

      expect(setBrightnessSpy).toHaveBeenCalledWith(deviceId, 200);
    });

    it('should handle brightness at minimum (0)', async () => {
      const deviceId = 'test-device';
      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'connected' as const,
        rssi: -50,
        state: { power: true, brightness: 128 } as DeviceState,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);
      const setBrightnessSpy = vi.spyOn(deviceManager, 'setBrightness').mockResolvedValue();

      await deviceManager.setBrightness(deviceId, 0);

      expect(setBrightnessSpy).toHaveBeenCalledWith(deviceId, 0);
    });

    it('should handle brightness at maximum (255)', async () => {
      const deviceId = 'test-device';
      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'connected' as const,
        rssi: -50,
        state: { power: true, brightness: 128 } as DeviceState,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);
      const setBrightnessSpy = vi.spyOn(deviceManager, 'setBrightness').mockResolvedValue();

      await deviceManager.setBrightness(deviceId, 255);

      expect(setBrightnessSpy).toHaveBeenCalledWith(deviceId, 255);
    });

    it('should throw error when device not connected', async () => {
      const deviceId = 'test-device';

      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'disconnected' as const,
        rssi: -50,
        state: null,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      /* Access internal devices map to set up test state */
      (deviceManager as any).devices.set(deviceId, device);

      await expect(deviceManager.setBrightness(deviceId, 128)).rejects.toThrow(
        'not connected'
      );
    });
  });

  describe('Color Control', () => {
    it('should send color command with valid RGB values', async () => {
      const deviceId = 'test-device';
      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'connected' as const,
        rssi: -50,
        state: { power: true, color: { r: 255, g: 255, b: 255 } } as DeviceState,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);
      const setColorSpy = vi.spyOn(deviceManager, 'setColor').mockResolvedValue();

      await deviceManager.setColor(deviceId, 255, 0, 0);

      expect(setColorSpy).toHaveBeenCalledWith(deviceId, 255, 0, 0);
    });

    it('should handle black color (0, 0, 0)', async () => {
      const deviceId = 'test-device';
      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'connected' as const,
        rssi: -50,
        state: { power: true, color: { r: 255, g: 255, b: 255 } } as DeviceState,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);
      const setColorSpy = vi.spyOn(deviceManager, 'setColor').mockResolvedValue();

      await deviceManager.setColor(deviceId, 0, 0, 0);

      expect(setColorSpy).toHaveBeenCalledWith(deviceId, 0, 0, 0);
    });

    it('should handle white color (255, 255, 255)', async () => {
      const deviceId = 'test-device';
      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'connected' as const,
        rssi: -50,
        state: { power: true, color: { r: 0, g: 0, b: 0 } } as DeviceState,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);
      const setColorSpy = vi.spyOn(deviceManager, 'setColor').mockResolvedValue();

      await deviceManager.setColor(deviceId, 255, 255, 255);

      expect(setColorSpy).toHaveBeenCalledWith(deviceId, 255, 255, 255);
    });

    it('should throw error when device not connected', async () => {
      const deviceId = 'test-device';

      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'disconnected' as const,
        rssi: -50,
        state: null,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      /* Access internal devices map to set up test state */
      (deviceManager as any).devices.set(deviceId, device);

      await expect(deviceManager.setColor(deviceId, 255, 0, 0)).rejects.toThrow(
        'not connected'
      );
    });
  });

  describe('Error Recovery', () => {
    it('should propagate error when power command fails', async () => {
      const deviceId = 'test-device';
      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'connected' as const,
        rssi: -50,
        state: { power: false } as DeviceState,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);
      vi.spyOn(deviceManager, 'setPower').mockRejectedValue(new Error('BLE command failed'));

      await expect(deviceManager.setPower(deviceId, true)).rejects.toThrow('BLE command failed');
    });

    it('should propagate error when brightness command fails', async () => {
      const deviceId = 'test-device';
      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'connected' as const,
        rssi: -50,
        state: { power: true, brightness: 128 } as DeviceState,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);
      vi.spyOn(deviceManager, 'setBrightness').mockRejectedValue(
        new Error('BLE command failed')
      );

      await expect(deviceManager.setBrightness(deviceId, 200)).rejects.toThrow(
        'BLE command failed'
      );
    });

    it('should propagate error when color command fails', async () => {
      const deviceId = 'test-device';
      const device = {
        id: deviceId,
        name: 'Test Device',
        connectionState: 'connected' as const,
        rssi: -50,
        state: { power: true, color: { r: 255, g: 255, b: 255 } } as DeviceState,
        bleDevice: { id: deviceId, name: 'Test', rssi: -50 } as any,
      };

      vi.spyOn(deviceManager, 'getDevice').mockReturnValue(device);
      vi.spyOn(deviceManager, 'setColor').mockRejectedValue(new Error('BLE command failed'));

      await expect(deviceManager.setColor(deviceId, 255, 0, 0)).rejects.toThrow(
        'BLE command failed'
      );
    });
  });
});
