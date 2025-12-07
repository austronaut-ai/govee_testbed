/**
 * Unit Tests for DeviceCard Components
 * Requirements: 4.4, 5.4, 6.1
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeviceCard } from './DeviceCard';
import { PowerToggle } from './PowerToggle';
import { BrightnessSlider } from './BrightnessSlider';
import { ColorPicker } from './ColorPicker';
import { ConnectionStatus } from './ConnectionStatus';
import type { ManagedDevice } from '../context/AppContext';

describe('DeviceCard Components', () => {
  describe('PowerToggle', () => {
    it('should be disabled when disconnected', () => {
      const mockToggle = vi.fn();
      const { container } = render(
        <PowerToggle power={false} disabled={true} onToggle={mockToggle} />
      );

      const button = container.querySelector('.toggle-button') as HTMLButtonElement;
      expect(button).toBeTruthy();
      expect(button.disabled).toBe(true);
    });

    it('should be enabled when connected', () => {
      const mockToggle = vi.fn();
      const { container } = render(
        <PowerToggle power={false} disabled={false} onToggle={mockToggle} />
      );

      const button = container.querySelector('.toggle-button') as HTMLButtonElement;
      expect(button).toBeTruthy();
      expect(button.disabled).toBe(false);
    });

    it('should call onToggle when clicked', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();
      const { container } = render(
        <PowerToggle power={false} disabled={false} onToggle={mockToggle} />
      );

      const button = container.querySelector('.toggle-button') as HTMLButtonElement;
      await user.click(button);
      expect(mockToggle).toHaveBeenCalledOnce();
    });
  });

  describe('BrightnessSlider', () => {
    it('should render conditionally based on device capability', () => {
      const mockHandlers = {
        onPowerToggle: vi.fn(),
        onBrightnessChange: vi.fn(),
        onColorChange: vi.fn(),
        onColorTemperatureChange: vi.fn(),
      };

      // Device without brightness support
      const deviceWithoutBrightness: ManagedDevice = {
        id: 'test-1',
        name: 'Test Device',
        connectionState: 'connected',
        rssi: -50,
        state: {
          power: true,
        },
      };

      const { container: container1 } = render(
        <DeviceCard device={deviceWithoutBrightness} {...mockHandlers} />
      );
      expect(container1.querySelector('.brightness-slider')).toBeFalsy();

      // Device with brightness support
      const deviceWithBrightness: ManagedDevice = {
        id: 'test-2',
        name: 'Test Device',
        connectionState: 'connected',
        rssi: -50,
        state: {
          power: true,
          brightness: 128,
        },
      };

      const { container: container2 } = render(
        <DeviceCard device={deviceWithBrightness} {...mockHandlers} />
      );
      expect(container2.querySelector('.brightness-slider')).toBeTruthy();
    });

    it('should be disabled when device is disconnected', () => {
      const mockChange = vi.fn();
      const { container } = render(
        <BrightnessSlider brightness={128} disabled={true} onChange={mockChange} />
      );

      const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
      expect(slider).toBeTruthy();
      expect(slider.disabled).toBe(true);
    });
  });

  describe('ColorPicker', () => {
    it('should render conditionally based on device capability', () => {
      const mockHandlers = {
        onPowerToggle: vi.fn(),
        onBrightnessChange: vi.fn(),
        onColorChange: vi.fn(),
        onColorTemperatureChange: vi.fn(),
      };

      // Device without color support
      const deviceWithoutColor: ManagedDevice = {
        id: 'test-1',
        name: 'Test Device',
        connectionState: 'connected',
        rssi: -50,
        state: {
          power: true,
        },
      };

      const { container: container1 } = render(
        <DeviceCard device={deviceWithoutColor} {...mockHandlers} />
      );
      expect(container1.querySelector('.color-picker')).toBeFalsy();

      // Device with color support
      const deviceWithColor: ManagedDevice = {
        id: 'test-2',
        name: 'Test Device',
        connectionState: 'connected',
        rssi: -50,
        state: {
          power: true,
          color: { r: 255, g: 0, b: 0 },
        },
      };

      const { container: container2 } = render(
        <DeviceCard device={deviceWithColor} {...mockHandlers} />
      );
      expect(container2.querySelector('.color-picker')).toBeTruthy();
    });

    it('should be disabled when device is disconnected', () => {
      const mockChange = vi.fn();
      const { container } = render(
        <ColorPicker
          color={{ r: 255, g: 0, b: 0 }}
          disabled={true}
          onChange={mockChange}
        />
      );

      const input = container.querySelector('input[type="color"]') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.disabled).toBe(true);
    });
  });

  describe('ConnectionStatus', () => {
    it('should display connected status', () => {
      const { container } = render(<ConnectionStatus connectionState="connected" />);
      expect(container.textContent).toContain('Connected');
      expect(container.querySelector('.status-connected')).toBeTruthy();
    });

    it('should display disconnected status', () => {
      const { container } = render(<ConnectionStatus connectionState="disconnected" />);
      expect(container.textContent).toContain('Disconnected');
      expect(container.querySelector('.status-disconnected')).toBeTruthy();
    });

    it('should display connecting status', () => {
      const { container } = render(<ConnectionStatus connectionState="connecting" />);
      expect(container.textContent).toContain('Connecting');
      expect(container.querySelector('.status-connecting')).toBeTruthy();
    });

    it('should display error status', () => {
      const { container } = render(<ConnectionStatus connectionState="error" />);
      expect(container.textContent).toContain('Error');
      expect(container.querySelector('.status-error')).toBeTruthy();
    });
  });

  describe('DeviceCard Integration', () => {
    it('should render all device information', () => {
      const mockHandlers = {
        onPowerToggle: vi.fn(),
        onBrightnessChange: vi.fn(),
        onColorChange: vi.fn(),
        onColorTemperatureChange: vi.fn(),
      };

      const device: ManagedDevice = {
        id: 'test-device',
        name: 'My Govee Light',
        connectionState: 'connected',
        rssi: -60,
        state: {
          power: true,
          brightness: 200,
          color: { r: 100, g: 150, b: 200 },
        },
      };

      const { container } = render(<DeviceCard device={device} {...mockHandlers} />);

      // Check device name
      expect(container.textContent).toContain('My Govee Light');

      // Check connection status
      expect(container.querySelector('.connection-status')).toBeTruthy();

      // Check signal strength
      expect(container.querySelector('.signal-strength')).toBeTruthy();

      // Check controls are present
      expect(container.querySelector('.power-toggle')).toBeTruthy();
      expect(container.querySelector('.brightness-slider')).toBeTruthy();
      expect(container.querySelector('.color-picker')).toBeTruthy();
    });

    it('should display error message when present', () => {
      const mockHandlers = {
        onPowerToggle: vi.fn(),
        onBrightnessChange: vi.fn(),
        onColorChange: vi.fn(),
        onColorTemperatureChange: vi.fn(),
      };

      const device: ManagedDevice = {
        id: 'test-device',
        name: 'My Govee Light',
        connectionState: 'error',
        rssi: -60,
        state: null,
        lastError: 'Connection timeout',
      };

      const { container } = render(<DeviceCard device={device} {...mockHandlers} />);

      expect(container.textContent).toContain('Connection timeout');
      expect(container.querySelector('.device-error')).toBeTruthy();
    });
  });
});
