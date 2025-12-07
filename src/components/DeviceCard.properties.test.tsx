/**
 * Property-Based Tests for DeviceCard Components
 * Feature: govee-bluetooth-dashboard, Property 12: UI control availability
 * Validates: Requirements 4.4, 5.4, 6.1
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { DeviceCard } from './DeviceCard';
import type { ManagedDevice, ConnectionState } from '../context/AppContext';
import type { DeviceState } from '../types/device';

// Arbitraries for generating test data
const arbConnectionState = (): fc.Arbitrary<ConnectionState> =>
  fc.constantFrom('disconnected', 'connecting', 'connected', 'error');

const arbRssi = (): fc.Arbitrary<number> => fc.integer({ min: -100, max: -30 });

const arbDeviceState = (): fc.Arbitrary<DeviceState> =>
  fc.record({
    power: fc.boolean(),
    brightness: fc.option(fc.integer({ min: 0, max: 255 }), { nil: undefined }),
    color: fc.option(
      fc.record({
        r: fc.integer({ min: 0, max: 255 }),
        g: fc.integer({ min: 0, max: 255 }),
        b: fc.integer({ min: 0, max: 255 }),
      }),
      { nil: undefined }
    ),
    colorTemperature: fc.option(fc.integer({ min: 2000, max: 9000 }), { nil: undefined }),
  });

const arbManagedDevice = (): fc.Arbitrary<ManagedDevice> =>
  fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    connectionState: arbConnectionState(),
    rssi: arbRssi(),
    state: fc.option(arbDeviceState(), { nil: null }),
    lastError: fc.option(fc.string(), { nil: undefined }),
  });

describe('DeviceCard Property Tests', () => {
  describe('Property 12: UI control availability', () => {
    it('should only enable controls when device is connected', () => {
      fc.assert(
        fc.property(arbManagedDevice(), (device) => {
          const mockHandlers = {
            onPowerToggle: () => { },
            onBrightnessChange: () => { },
            onColorChange: () => { },
            onColorTemperatureChange: () => { },
          };

          const { container } = render(
            <DeviceCard device={device} {...mockHandlers} />
          );

          const isConnected = device.connectionState === 'connected';

          // Power toggle should always be present but disabled when not connected
          const powerButton = container.querySelector('.toggle-button');
          expect(powerButton).toBeTruthy();

          if (powerButton) {
            const isDisabled = (powerButton as HTMLButtonElement).disabled;
            expect(isDisabled).toBe(!isConnected);
          }

          // Brightness slider should only be present if device supports it
          const brightnessSlider = container.querySelector('.brightness-slider input');
          if (device.state?.brightness !== undefined) {
            expect(brightnessSlider).toBeTruthy();
            if (brightnessSlider) {
              const isDisabled = (brightnessSlider as HTMLInputElement).disabled;
              expect(isDisabled).toBe(!isConnected);
            }
          }

          // Color picker should only be present if device supports it
          const colorPicker = container.querySelector('.color-picker input');
          if (device.state?.color !== undefined) {
            expect(colorPicker).toBeTruthy();
            if (colorPicker) {
              const isDisabled = (colorPicker as HTMLInputElement).disabled;
              expect(isDisabled).toBe(!isConnected);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should only render brightness control when device supports brightness', () => {
      fc.assert(
        fc.property(arbManagedDevice(), (device) => {
          const mockHandlers = {
            onPowerToggle: () => { },
            onBrightnessChange: () => { },
            onColorChange: () => { },
            onColorTemperatureChange: () => { },
          };

          const { container } = render(
            <DeviceCard device={device} {...mockHandlers} />
          );

          const brightnessSlider = container.querySelector('.brightness-slider');
          const supportsBrightness = device.state?.brightness !== undefined;

          if (supportsBrightness) {
            expect(brightnessSlider).toBeTruthy();
          } else {
            expect(brightnessSlider).toBeFalsy();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should only render color control when device supports color', () => {
      fc.assert(
        fc.property(arbManagedDevice(), (device) => {
          const mockHandlers = {
            onPowerToggle: () => { },
            onBrightnessChange: () => { },
            onColorChange: () => { },
            onColorTemperatureChange: () => { },
          };

          const { container } = render(
            <DeviceCard device={device} {...mockHandlers} />
          );

          const colorPicker = container.querySelector('.color-picker');
          const supportsColor = device.state?.color !== undefined;

          if (supportsColor) {
            expect(colorPicker).toBeTruthy();
          } else {
            expect(colorPicker).toBeFalsy();
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
