// Connection Quality Monitoring Service
// Implements Requirements 9.2, 9.3, 9.4

import type { BLEDevice } from './ble.service';

// RSSI thresholds (in dBm)
export const RSSI_THRESHOLD_WEAK = -70; // Below this is considered weak
export const RSSI_THRESHOLD_OUT_OF_RANGE = -90; // Below this is considered out of range

export interface ConnectionQuality {
  deviceId: string;
  rssi: number;
  isWeak: boolean;
  isOutOfRange: boolean;
}

export type QualityUpdateCallback = (quality: ConnectionQuality) => void;

interface MonitoredDevice {
  device: BLEDevice;
  callback: QualityUpdateCallback;
  currentRSSI: number;
}

/**
 * ConnectionQualityMonitor - Monitors RSSI and connection quality for BLE devices
 * Requirements: 9.2, 9.3, 9.4
 */
export class ConnectionQualityMonitor {
  private monitoredDevices: Map<string, MonitoredDevice> = new Map();

  /**
   * Start monitoring connection quality for a device
   * Requirement 9.2: Monitor and display connection quality
   */
  startMonitoring(device: BLEDevice, callback: QualityUpdateCallback): void {
    this.monitoredDevices.set(device.id, {
      device,
      callback,
      currentRSSI: device.rssi,
    });

    // Initial quality update
    this.notifyQualityUpdate(device.id, device.rssi);
  }

  /**
   * Stop monitoring connection quality for a device
   */
  stopMonitoring(deviceId: string): void {
    this.monitoredDevices.delete(deviceId);
  }

  /**
   * Check if a device is being monitored
   */
  isMonitoring(deviceId: string): boolean {
    return this.monitoredDevices.has(deviceId);
  }

  /**
   * Update RSSI value for a monitored device
   * Requirement 9.2: Monitor connection quality
   */
  updateRSSI(deviceId: string, rssi: number): void {
    const monitored = this.monitoredDevices.get(deviceId);
    if (!monitored) {
      return;
    }

    monitored.currentRSSI = rssi;
    this.notifyQualityUpdate(deviceId, rssi);
  }

  /**
   * Get current quality information for a device
   */
  getQuality(deviceId: string): ConnectionQuality | null {
    const monitored = this.monitoredDevices.get(deviceId);
    if (!monitored) {
      return null;
    }

    return this.calculateQuality(deviceId, monitored.currentRSSI);
  }

  /**
   * Calculate connection quality based on RSSI
   * Requirements: 9.3 (threshold detection), 9.4 (out-of-range detection)
   */
  private calculateQuality(deviceId: string, rssi: number): ConnectionQuality {
    const isWeak = rssi < RSSI_THRESHOLD_WEAK;
    const isOutOfRange = rssi < RSSI_THRESHOLD_OUT_OF_RANGE;

    return {
      deviceId,
      rssi,
      isWeak,
      isOutOfRange,
    };
  }

  /**
   * Notify callback of quality update
   */
  private notifyQualityUpdate(deviceId: string, rssi: number): void {
    const monitored = this.monitoredDevices.get(deviceId);
    if (!monitored) {
      return;
    }

    const quality = this.calculateQuality(deviceId, rssi);
    monitored.callback(quality);
  }
}
