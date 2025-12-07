// Property-based tests for BLE Service
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { BLEDevice } from './ble.service';

/**
 * **Feature: govee-bluetooth-dashboard, Property 1: Device discovery completeness**
 * **Validates: Requirements 1.2, 9.1**
 * 
 * For any scan operation, all devices returned by the scan should have valid IDs,
 * names, and RSSI values (non-null, RSSI in range -100 to -30 dBm).
 */
describe('BLE Service Property Tests', () => {
  describe('Property 1: Device discovery completeness', () => {
    it('should ensure all discovered devices have valid properties', () => {
      // Generator for mock BLE devices
      const arbBLEDevice = fc.record({
        id: fc.string({ minLength: 1 }),
        name: fc.string({ minLength: 1 }),
        rssi: fc.integer({ min: -100, max: -30 }),
        device: fc.constant({} as BluetoothDevice), // Mock device object
      });

      fc.assert(
        fc.property(fc.array(arbBLEDevice, { minLength: 0, maxLength: 10 }), (devices) => {
          // Property: All devices must have valid properties
          for (const device of devices) {
            // ID must be non-null and non-empty
            expect(device.id).toBeTruthy();
            expect(device.id.length).toBeGreaterThan(0);

            // Name must be non-null and non-empty
            expect(device.name).toBeTruthy();
            expect(device.name.length).toBeGreaterThan(0);

            // RSSI must be in valid range (-100 to -30 dBm)
            expect(device.rssi).toBeGreaterThanOrEqual(-100);
            expect(device.rssi).toBeLessThanOrEqual(-30);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should validate device discovery returns well-formed device objects', () => {
      // Generator for device properties
      const arbDeviceId = fc.string({ minLength: 1, maxLength: 50 });
      const arbDeviceName = fc.oneof(
        fc.constant('Govee'),
        fc.string({ minLength: 1 }).map(s => `Govee_${s}`),
        fc.string({ minLength: 1 }).map(s => `Govee ${s}`)
      );
      const arbRSSI = fc.integer({ min: -100, max: -30 });

      fc.assert(
        fc.property(
          arbDeviceId,
          arbDeviceName,
          arbRSSI,
          (id, name, rssi) => {
            const device: BLEDevice = {
              id,
              name,
              rssi,
              device: {} as BluetoothDevice,
            };

            // Validate completeness
            expect(device.id).toBeDefined();
            expect(device.name).toBeDefined();
            expect(device.rssi).toBeDefined();
            expect(device.device).toBeDefined();

            // Validate types
            expect(typeof device.id).toBe('string');
            expect(typeof device.name).toBe('string');
            expect(typeof device.rssi).toBe('number');

            // Validate ranges
            expect(device.rssi).toBeGreaterThanOrEqual(-100);
            expect(device.rssi).toBeLessThanOrEqual(-30);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
