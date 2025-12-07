// Device Manager wrapper with automatic retry logic
import { DeviceManager } from './device-manager';
import { BLEService } from './ble.service';
import { retryOperation, getErrorRecoveryStrategy } from '../utils/error-handler';

/**
 * Extended Device Manager with automatic retry logic for transient errors
 */
export class DeviceManagerWithRetry extends DeviceManager {
  constructor(bleService: BLEService) {
    super(bleService);
  }

  /**
   * Connect to a device with automatic retry for transient errors
   */
  async connectDevice(deviceId: string): Promise<void> {
    try {
      await retryOperation(() => super.connectDevice(deviceId));
    } catch (error) {
      const strategy = getErrorRecoveryStrategy(error);
      
      // Update device with user-friendly error message
      const device = this.getDevice(deviceId);
      if (device) {
        device.lastError = strategy.userMessage;
      }
      
      throw error;
    }
  }

  /**
   * Send command with automatic retry for transient errors
   */
  async sendCommand(deviceId: string, command: Uint8Array): Promise<void> {
    try {
      const strategy = getErrorRecoveryStrategy(new Error('Command'));
      
      if (strategy.shouldRetry && strategy.retryConfig) {
        await retryOperation(
          () => super.sendCommand(deviceId, command),
          strategy.retryConfig
        );
      } else {
        await super.sendCommand(deviceId, command);
      }
    } catch (error) {
      const strategy = getErrorRecoveryStrategy(error);
      
      // Update device with user-friendly error message
      const device = this.getDevice(deviceId);
      if (device) {
        device.lastError = strategy.userMessage;
      }
      
      throw error;
    }
  }

  /**
   * Set power with automatic retry
   */
  async setPower(deviceId: string, on: boolean): Promise<void> {
    try {
      await retryOperation(() => super.setPower(deviceId, on), {
        maxAttempts: 2,
        delayMs: 500,
        backoffMultiplier: 2,
      });
    } catch (error) {
      const strategy = getErrorRecoveryStrategy(error);
      
      const device = this.getDevice(deviceId);
      if (device) {
        device.lastError = strategy.userMessage;
      }
      
      throw error;
    }
  }

  /**
   * Set brightness with automatic retry
   */
  async setBrightness(deviceId: string, brightness: number): Promise<void> {
    try {
      await retryOperation(() => super.setBrightness(deviceId, brightness), {
        maxAttempts: 2,
        delayMs: 500,
        backoffMultiplier: 2,
      });
    } catch (error) {
      const strategy = getErrorRecoveryStrategy(error);
      
      const device = this.getDevice(deviceId);
      if (device) {
        device.lastError = strategy.userMessage;
      }
      
      throw error;
    }
  }

  /**
   * Set color with automatic retry
   */
  async setColor(deviceId: string, r: number, g: number, b: number): Promise<void> {
    try {
      await retryOperation(() => super.setColor(deviceId, r, g, b), {
        maxAttempts: 2,
        delayMs: 500,
        backoffMultiplier: 2,
      });
    } catch (error) {
      const strategy = getErrorRecoveryStrategy(error);
      
      const device = this.getDevice(deviceId);
      if (device) {
        device.lastError = strategy.userMessage;
      }
      
      throw error;
    }
  }
}
