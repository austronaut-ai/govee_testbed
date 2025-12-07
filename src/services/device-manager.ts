// Device Manager - Orchestrates device lifecycle and state management
import { BLEService, type BLEDevice } from './ble.service';
import {
  encodePowerCommand,
  encodeBrightnessCommand,
  encodeColorCommand,
  encodeColorTemperatureCommand,
} from '../utils/command-encoder';
import type { DeviceState } from '../types/device';
import { ConnectionQualityMonitor } from './connection-quality';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type DeviceUpdateCallback = (device: ManagedDevice) => void;

export interface ManagedDevice {
  id: string;
  name: string;
  connectionState: ConnectionState;
  rssi: number;
  state: DeviceState | null;
  lastError?: string;
  bleDevice?: BLEDevice;
  connectionQuality?: {
    isWeak: boolean;
    isOutOfRange: boolean;
  };
}

interface ConnectionRequest {
  deviceId: string;
  resolve: () => void;
  reject: (error: Error) => void;
}

export class DeviceManager {
  private devices: Map<string, ManagedDevice> = new Map();
  private bleService: BLEService;
  private connectionQueue: ConnectionRequest[] = [];
  private isProcessingQueue = false;
  private stateUpdateTimeout = 2000; // 2 seconds as per requirement 7.4
  private listeners: Set<DeviceUpdateCallback> = new Set();
  private qualityMonitor: ConnectionQualityMonitor;

  constructor(bleService: BLEService) {
    this.bleService = bleService;
    this.qualityMonitor = new ConnectionQualityMonitor();

    // specific handler for unexpected disconnections
    this.bleService.onDisconnect((deviceId) => {
      this.handleUnexpectedDisconnection(deviceId);
    });
  }

  /**
   * Subscribe to device updates
   */
  subscribe(callback: DeviceUpdateCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of device update
   */
  private notifyListeners(device: ManagedDevice) {
    this.listeners.forEach(callback => {
      try {
        callback({ ...device });
      } catch (error) {
        console.error('Error in device listener:', error);
      }
    });
  }

  /**
   * Handle unexpected disconnection from BLE service
   */
  private handleUnexpectedDisconnection(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (!device) return;

    // Stop monitoring connection quality
    this.qualityMonitor.stopMonitoring(deviceId);

    // Update state
    device.connectionState = 'disconnected';
    device.state = null;
    device.connectionQuality = undefined;

    // Notify state update
    this.notifyStateUpdate(deviceId, null);
  }

  /**
   * Notify all callbacks of a state update
   */
  private notifyStateUpdate(deviceId: string, _state: DeviceState | null): void {
    const device = this.devices.get(deviceId);
    if (device) {
      this.notifyListeners(device);
    }
  }

  /**
   * Discover devices via BLE scan
   */
  async discoverDevices(): Promise<ManagedDevice[]> {
    const bleDevices = await this.bleService.scanForDevices();

    const managedDevices: ManagedDevice[] = [];
    for (const bleDevice of bleDevices) {
      const existingDevice = this.devices.get(bleDevice.id);

      const managedDevice: ManagedDevice = {
        id: bleDevice.id,
        name: bleDevice.name,
        connectionState: existingDevice?.connectionState || 'disconnected',
        rssi: bleDevice.rssi,
        state: existingDevice?.state || null,
        lastError: existingDevice?.lastError,
        bleDevice,
      };

      this.devices.set(bleDevice.id, managedDevice);
      managedDevices.push(managedDevice);
    }

    return managedDevices;
  }

  /**
   * Connect to a device (queued for FIFO ordering)
   */
  async connectDevice(deviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const device = this.devices.get(deviceId);
      if (!device) {
        reject(new Error(`Device ${deviceId} not found`));
        return;
      }

      // Update state to connecting
      device.connectionState = 'connecting';
      device.lastError = undefined;

      // Add to queue
      this.connectionQueue.push({ deviceId, resolve, reject });

      // Process queue
      this.processConnectionQueue();
    });
  }

  /**
   * Process connection queue in FIFO order
   */
  private async processConnectionQueue(): Promise<void> {
    if (this.isProcessingQueue || this.connectionQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.connectionQueue.length > 0) {
      const request = this.connectionQueue.shift()!;
      await this.executeConnection(request);
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute a single connection request
   */
  private async executeConnection(request: ConnectionRequest): Promise<void> {
    const { deviceId, resolve, reject } = request;
    const device = this.devices.get(deviceId);

    if (!device || !device.bleDevice) {
      reject(new Error(`Device ${deviceId} not found or missing BLE device`));
      return;
    }

    try {
      // Connect via BLE service
      await this.bleService.connect(device.bleDevice);

      // Update connection state
      device.connectionState = 'connected';
      device.lastError = undefined;

      // Start monitoring connection quality (Requirement 9.2)
      this.qualityMonitor.startMonitoring(device.bleDevice, (quality) => {
        const managedDevice = this.devices.get(deviceId);
        if (managedDevice) {
          managedDevice.rssi = quality.rssi;
          managedDevice.connectionQuality = {
            isWeak: quality.isWeak,
            isOutOfRange: quality.isOutOfRange,
          };

          // Handle out-of-range disconnection (Requirement 9.4)
          if (quality.isOutOfRange && managedDevice.connectionState === 'connected') {
            this.disconnectDevice(deviceId).catch(() => {
              // Ignore errors during automatic disconnection
            });
          }
        }
      });

      // Read initial device state with timeout
      const state = await this.readDeviceStateWithTimeout(device.bleDevice);
      device.state = state;

      // Notify state update
      this.notifyStateUpdate(deviceId, state);

      resolve();
    } catch (error) {
      device.connectionState = 'error';
      device.lastError = error instanceof Error ? error.message : 'Connection failed';
      reject(error as Error);
    }
  }

  /**
   * Read device state with timeout handling
   */
  private async readDeviceStateWithTimeout(bleDevice: BLEDevice): Promise<DeviceState | null> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('State read timeout')), this.stateUpdateTimeout);
      });

      const statePromise = this.bleService.readDeviceState(bleDevice);

      // Race between state read and timeout
      const state = await Promise.race([statePromise, timeoutPromise]);
      return state;
    } catch (error) {
      // Return null on timeout or error (requirement 7.5)
      return null;
    }
  }

  /**
   * Disconnect from a device
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device || !device.bleDevice) {
      throw new Error(`Device ${deviceId} not found`);
    }

    try {
      // Stop monitoring connection quality
      this.qualityMonitor.stopMonitoring(deviceId);

      await this.bleService.disconnect(device.bleDevice);
      device.connectionState = 'disconnected';
      device.lastError = undefined;
      device.connectionQuality = undefined;
    } catch (error) {
      device.connectionState = 'error';
      device.lastError = error instanceof Error ? error.message : 'Disconnection failed';
      throw error;
    }
  }

  /**
   * Send a command to a device
   */
  async sendCommand(deviceId: string, command: Uint8Array): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device || !device.bleDevice) {
      throw new Error(`Device ${deviceId} not found`);
    }

    if (device.connectionState !== 'connected') {
      throw new Error(`Device ${deviceId} is not connected`);
    }

    await this.bleService.sendCommand(device.bleDevice, command);
  }

  /**
   * Get current device state with timeout
   */
  async getDeviceState(deviceId: string): Promise<DeviceState | null> {
    const device = this.devices.get(deviceId);
    if (!device || !device.bleDevice) {
      throw new Error(`Device ${deviceId} not found`);
    }

    if (device.connectionState !== 'connected') {
      return device.state;
    }

    const state = await this.readDeviceStateWithTimeout(device.bleDevice);
    device.state = state;

    // Notify state update
    this.notifyStateUpdate(deviceId, state);

    return state;
  }

  /**
   * Send power command and update state
   */
  async setPower(deviceId: string, on: boolean): Promise<void> {
    const command = encodePowerCommand(on);
    await this.sendCommand(deviceId, command);

    // Update state after command (with small delay for device to process)
    setTimeout(() => {
      this.getDeviceState(deviceId).catch(() => {
        // Ignore errors during state refresh
      });
    }, 100);
  }

  /**
   * Send brightness command and update state
   */
  async setBrightness(deviceId: string, brightness: number): Promise<void> {
    const command = encodeBrightnessCommand(brightness);
    await this.sendCommand(deviceId, command);

    // Update state after command (with small delay for device to process)
    setTimeout(() => {
      this.getDeviceState(deviceId).catch(() => {
        // Ignore errors during state refresh
      });
    }, 100);
  }

  /**
   * Send color command and update state
   */
  async setColor(deviceId: string, r: number, g: number, b: number): Promise<void> {
    const command = encodeColorCommand(r, g, b);
    await this.sendCommand(deviceId, command);

    // Update state after command (with small delay for device to process)
    setTimeout(() => {
      this.getDeviceState(deviceId).catch(() => {
        // Ignore errors during state refresh
      });
    }, 100);
  }

  /**
   * Send color temperature command and update state
   */
  async setColorTemperature(deviceId: string, kelvin: number): Promise<void> {
    const command = encodeColorTemperatureCommand(kelvin);
    await this.sendCommand(deviceId, command);

    // Update state after command (with small delay for device to process)
    setTimeout(() => {
      this.getDeviceState(deviceId).catch(() => {
        // Ignore errors during state refresh
      });
    }, 100);
  }

  /**
   * Get all devices
   */
  getDevices(): Map<string, ManagedDevice> {
    return new Map(this.devices);
  }

  /**
   * Get a specific device
   */
  getDevice(deviceId: string): ManagedDevice | undefined {
    return this.devices.get(deviceId);
  }
}
