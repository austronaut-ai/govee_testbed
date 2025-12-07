// Unit tests for connection quality monitoring
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionQualityMonitor, RSSI_THRESHOLD_WEAK } from './connection-quality';
import type { BLEDevice } from './ble.service';

describe('ConnectionQualityMonitor', () => {
  let monitor: ConnectionQualityMonitor;
  let mockDevice: BLEDevice;

  beforeEach(() => {
    monitor = new ConnectionQualityMonitor();
    mockDevice = {
      id: 'test-device-1',
      name: 'Test Govee Device',
      rssi: -50,
      device: {} as BluetoothDevice,
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    monitor.stopMonitoring('test-device-1');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('RSSI monitoring', () => {
    it('should start monitoring RSSI for a device', () => {
      const callback = vi.fn();
      monitor.startMonitoring(mockDevice, callback);

      // Verify monitoring started
      expect(monitor.isMonitoring('test-device-1')).toBe(true);
    });

    it('should stop monitoring RSSI for a device', () => {
      const callback = vi.fn();
      monitor.startMonitoring(mockDevice, callback);
      monitor.stopMonitoring('test-device-1');

      // Verify monitoring stopped
      expect(monitor.isMonitoring('test-device-1')).toBe(false);
    });

    it('should update RSSI value when monitoring', () => {
      const callback = vi.fn();
      monitor.startMonitoring(mockDevice, callback);

      // Update RSSI
      monitor.updateRSSI('test-device-1', -60);

      // Verify callback was called with new RSSI
      expect(callback).toHaveBeenCalledWith({
        deviceId: 'test-device-1',
        rssi: -60,
        isWeak: false,
        isOutOfRange: false,
      });
    });

    it('should not call callback if device is not being monitored', () => {
      const callback = vi.fn();
      
      // Update RSSI without starting monitoring
      monitor.updateRSSI('test-device-1', -60);

      // Verify callback was not called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('threshold detection', () => {
    it('should detect weak signal when RSSI drops below threshold', () => {
      const callback = vi.fn();
      monitor.startMonitoring(mockDevice, callback);

      // Update RSSI to weak signal (below -70 dBm)
      monitor.updateRSSI('test-device-1', -75);

      // Verify callback indicates weak signal
      expect(callback).toHaveBeenCalledWith({
        deviceId: 'test-device-1',
        rssi: -75,
        isWeak: true,
        isOutOfRange: false,
      });
    });

    it('should detect strong signal when RSSI is above threshold', () => {
      const callback = vi.fn();
      monitor.startMonitoring(mockDevice, callback);

      // Update RSSI to strong signal (above -70 dBm)
      monitor.updateRSSI('test-device-1', -50);

      // Verify callback indicates strong signal
      expect(callback).toHaveBeenCalledWith({
        deviceId: 'test-device-1',
        rssi: -50,
        isWeak: false,
        isOutOfRange: false,
      });
    });

    it('should detect out-of-range when RSSI is extremely weak', () => {
      const callback = vi.fn();
      monitor.startMonitoring(mockDevice, callback);

      // Update RSSI to out-of-range signal (below -90 dBm)
      monitor.updateRSSI('test-device-1', -95);

      // Verify callback indicates out of range
      expect(callback).toHaveBeenCalledWith({
        deviceId: 'test-device-1',
        rssi: -95,
        isWeak: true,
        isOutOfRange: true,
      });
    });

    it('should use correct threshold value for weak signal detection', () => {
      const callback = vi.fn();
      monitor.startMonitoring(mockDevice, callback);

      // Test at threshold boundary
      monitor.updateRSSI('test-device-1', RSSI_THRESHOLD_WEAK);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ isWeak: false })
      );

      // Test just below threshold
      monitor.updateRSSI('test-device-1', RSSI_THRESHOLD_WEAK - 1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ isWeak: true })
      );
    });
  });

  describe('warning display', () => {
    it('should indicate warning when signal is weak', () => {
      const callback = vi.fn();
      monitor.startMonitoring(mockDevice, callback);

      // Update to weak signal
      monitor.updateRSSI('test-device-1', -75);

      // Get quality info
      const quality = monitor.getQuality('test-device-1');
      expect(quality?.isWeak).toBe(true);
    });

    it('should not indicate warning when signal is strong', () => {
      const callback = vi.fn();
      monitor.startMonitoring(mockDevice, callback);

      // Update to strong signal
      monitor.updateRSSI('test-device-1', -50);

      // Get quality info
      const quality = monitor.getQuality('test-device-1');
      expect(quality?.isWeak).toBe(false);
    });

    it('should return null quality info for unmonitored device', () => {
      const quality = monitor.getQuality('unknown-device');
      expect(quality).toBeNull();
    });
  });

  describe('multiple devices', () => {
    it('should monitor multiple devices independently', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const device2: BLEDevice = {
        id: 'test-device-2',
        name: 'Test Govee Device 2',
        rssi: -60,
        device: {} as BluetoothDevice,
      };

      monitor.startMonitoring(mockDevice, callback1);
      monitor.startMonitoring(device2, callback2);

      // Clear initial calls from startMonitoring
      callback1.mockClear();
      callback2.mockClear();

      // Update RSSI for device 1
      monitor.updateRSSI('test-device-1', -80);

      // Verify only callback1 was called
      expect(callback1).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'test-device-1', rssi: -80 })
      );
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should stop monitoring specific device without affecting others', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const device2: BLEDevice = {
        id: 'test-device-2',
        name: 'Test Govee Device 2',
        rssi: -60,
        device: {} as BluetoothDevice,
      };

      monitor.startMonitoring(mockDevice, callback1);
      monitor.startMonitoring(device2, callback2);

      // Stop monitoring device 1
      monitor.stopMonitoring('test-device-1');

      // Verify device 1 stopped, device 2 still monitored
      expect(monitor.isMonitoring('test-device-1')).toBe(false);
      expect(monitor.isMonitoring('test-device-2')).toBe(true);
    });
  });
});
