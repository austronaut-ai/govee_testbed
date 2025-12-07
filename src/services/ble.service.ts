// BLE Communication Service for Govee devices
import type { DeviceState } from '../types/device';
import { parseDeviceState } from '../utils/command-encoder';

// Govee BLE Protocol Constants
export const GOVEE_SERVICE_UUID = '00010203-0405-0607-0809-0a0b0c0d1910';
export const GOVEE_CONTROL_CHAR_UUID = '00010203-0405-0607-0809-0a0b0c0d2b11';

export interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  device: BluetoothDevice;
  server?: BluetoothRemoteGATTServer;
}

export enum BLEErrorCode {
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  USER_CANCELLED = 'USER_CANCELLED',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  COMMAND_FAILED = 'COMMAND_FAILED',
  TIMEOUT = 'TIMEOUT',
  CHARACTERISTIC_NOT_FOUND = 'CHARACTERISTIC_NOT_FOUND',
}

export class BLEError extends Error {
  constructor(
    message: string,
    public code: BLEErrorCode,
    public deviceId?: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'BLEError';
  }
}

export class BLEService {
  private connectedDevices: Map<string, BLEDevice> = new Map();
  private characteristicSubscriptions: Map<string, () => void> = new Map();
  private disconnectCallbacks: Set<(deviceId: string) => void> = new Set();

  /**
   * Register a callback for device disconnection
   */
  onDisconnect(callback: (deviceId: string) => void): () => void {
    this.disconnectCallbacks.add(callback);
    return () => {
      this.disconnectCallbacks.delete(callback);
    };
  }

  /**
   * Check if Web Bluetooth API is supported
   */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Scan for Govee devices using Web Bluetooth API
   */
  async scanForDevices(): Promise<BLEDevice[]> {
    if (!this.isSupported()) {
      throw new BLEError(
        'Web Bluetooth API is not supported in this browser',
        BLEErrorCode.NOT_SUPPORTED,
        undefined,
        false
      );
    }

    try {
      // Request device with Govee service filter
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'Govee' },
          { services: [GOVEE_SERVICE_UUID] },
        ],
        optionalServices: [GOVEE_SERVICE_UUID],
      });

      // Get RSSI if available (not all browsers support this)
      const rssi = -50; // Default value since RSSI is not directly available in Web Bluetooth API

      const bleDevice: BLEDevice = {
        id: device.id,
        name: device.name || 'Unknown Govee Device',
        rssi,
        device,
      };

      return [bleDevice];
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          throw new BLEError(
            'No Govee devices found',
            BLEErrorCode.DEVICE_NOT_FOUND
          );
        }
        if (error.name === 'NotAllowedError') {
          throw new BLEError(
            'User cancelled device selection',
            BLEErrorCode.USER_CANCELLED
          );
        }
      }
      throw new BLEError(
        'Failed to scan for devices',
        BLEErrorCode.DEVICE_NOT_FOUND
      );
    }
  }

  /**
   * Connect to a BLE device
   */
  async connect(bleDevice: BLEDevice): Promise<void> {
    try {
      if (!bleDevice.device.gatt) {
        throw new BLEError(
          'Device does not support GATT',
          BLEErrorCode.CONNECTION_FAILED,
          bleDevice.id
        );
      }

      const server = await bleDevice.device.gatt.connect();
      bleDevice.server = server;
      this.connectedDevices.set(bleDevice.id, bleDevice);

      // Set up disconnection handler
      bleDevice.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnection(bleDevice.id);
      });
    } catch (error) {
      throw new BLEError(
        `Failed to connect to device: ${error instanceof Error ? error.message : 'Unknown error'}`,
        BLEErrorCode.CONNECTION_FAILED,
        bleDevice.id
      );
    }
  }

  /**
   * Disconnect from a BLE device
   */
  async disconnect(bleDevice: BLEDevice): Promise<void> {
    try {
      // Clean up subscriptions
      this.cleanupSubscriptions(bleDevice.id);

      // Disconnect GATT server
      if (bleDevice.server?.connected) {
        bleDevice.device.gatt?.disconnect();
      }

      // Remove from connected devices
      this.connectedDevices.delete(bleDevice.id);
    } catch (error) {
      throw new BLEError(
        `Failed to disconnect device: ${error instanceof Error ? error.message : 'Unknown error'}`,
        BLEErrorCode.CONNECTION_FAILED,
        bleDevice.id
      );
    }
  }

  /**
   * Read a characteristic value
   */
  async readCharacteristic(
    bleDevice: BLEDevice,
    serviceUuid: string,
    charUuid: string
  ): Promise<DataView> {
    try {
      if (!bleDevice.server?.connected) {
        throw new BLEError(
          'Device is not connected',
          BLEErrorCode.CONNECTION_FAILED,
          bleDevice.id
        );
      }

      const service = await bleDevice.server.getPrimaryService(serviceUuid);
      const characteristic = await service.getCharacteristic(charUuid);
      const value = await characteristic.readValue();

      return value;
    } catch (error) {
      throw new BLEError(
        `Failed to read characteristic: ${error instanceof Error ? error.message : 'Unknown error'}`,
        BLEErrorCode.COMMAND_FAILED,
        bleDevice.id
      );
    }
  }

  /**
   * Write a characteristic value
   */
  async writeCharacteristic(
    bleDevice: BLEDevice,
    serviceUuid: string,
    charUuid: string,
    data: Uint8Array
  ): Promise<void> {
    try {
      if (!bleDevice.server?.connected) {
        throw new BLEError(
          'Device is not connected',
          BLEErrorCode.CONNECTION_FAILED,
          bleDevice.id
        );
      }

      const service = await bleDevice.server.getPrimaryService(serviceUuid);
      const characteristic = await service.getCharacteristic(charUuid);
      await characteristic.writeValueWithoutResponse(data);
    } catch (error) {
      throw new BLEError(
        `Failed to write characteristic: ${error instanceof Error ? error.message : 'Unknown error'}`,
        BLEErrorCode.COMMAND_FAILED,
        bleDevice.id
      );
    }
  }

  /**
   * Subscribe to characteristic notifications
   */
  async subscribeToCharacteristic(
    bleDevice: BLEDevice,
    serviceUuid: string,
    charUuid: string,
    callback: (data: DataView) => void
  ): Promise<void> {
    try {
      if (!bleDevice.server?.connected) {
        throw new BLEError(
          'Device is not connected',
          BLEErrorCode.CONNECTION_FAILED,
          bleDevice.id
        );
      }

      const service = await bleDevice.server.getPrimaryService(serviceUuid);
      const characteristic = await service.getCharacteristic(charUuid);

      const handler = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          callback(target.value);
        }
      };

      characteristic.addEventListener('characteristicvaluechanged', handler);
      await characteristic.startNotifications();

      // Store cleanup function
      const subscriptionKey = `${bleDevice.id}-${serviceUuid}-${charUuid}`;
      this.characteristicSubscriptions.set(subscriptionKey, () => {
        characteristic.removeEventListener('characteristicvaluechanged', handler);
        characteristic.stopNotifications().catch(() => {
          // Ignore errors during cleanup
        });
      });
    } catch (error) {
      throw new BLEError(
        `Failed to subscribe to characteristic: ${error instanceof Error ? error.message : 'Unknown error'}`,
        BLEErrorCode.COMMAND_FAILED,
        bleDevice.id
      );
    }
  }

  /**
   * Read device state
   */
  async readDeviceState(bleDevice: BLEDevice): Promise<DeviceState | null> {
    try {
      const data = await this.readCharacteristic(
        bleDevice,
        GOVEE_SERVICE_UUID,
        GOVEE_CONTROL_CHAR_UUID
      );
      return parseDeviceState(data);
    } catch (error) {
      // Return null if state reading fails
      return null;
    }
  }

  /**
   * Send command to device
   */
  async sendCommand(bleDevice: BLEDevice, command: Uint8Array): Promise<void> {
    await this.writeCharacteristic(
      bleDevice,
      GOVEE_SERVICE_UUID,
      GOVEE_CONTROL_CHAR_UUID,
      command
    );
  }

  /**
   * Handle unexpected disconnection
   */
  private handleDisconnection(deviceId: string): void {
    this.cleanupSubscriptions(deviceId);
    this.connectedDevices.delete(deviceId);

    // Notify listeners
    this.disconnectCallbacks.forEach(callback => {
      try {
        callback(deviceId);
      } catch (e) {
        console.error('Error in disconnect callback:', e);
      }
    });
  }

  /**
   * Clean up all subscriptions for a device
   */
  private cleanupSubscriptions(deviceId: string): void {
    const subscriptionsToRemove: string[] = [];

    for (const [key, cleanup] of this.characteristicSubscriptions.entries()) {
      if (key.startsWith(deviceId)) {
        cleanup();
        subscriptionsToRemove.push(key);
      }
    }

    subscriptionsToRemove.forEach((key) => {
      this.characteristicSubscriptions.delete(key);
    });
  }

  /**
   * Get connected device by ID
   */
  getConnectedDevice(deviceId: string): BLEDevice | undefined {
    return this.connectedDevices.get(deviceId);
  }

  /**
   * Check if device is connected
   */
  isConnected(deviceId: string): boolean {
    const device = this.connectedDevices.get(deviceId);
    return device?.server?.connected ?? false;
  }
}
