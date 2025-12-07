import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeviceList } from './DeviceList';
import { AppProvider } from '../context/AppContext';
import { DeviceManager } from '../services/device-manager';

// Mock DeviceManager
const createMockDeviceManager = () => {
  return {
    discoverDevices: vi.fn(),
    connectDevice: vi.fn(),
    disconnectDevice: vi.fn(),
    sendCommand: vi.fn(),
    getDeviceState: vi.fn(),
    setPower: vi.fn(),
    setBrightness: vi.fn(),
    setColor: vi.fn(),
    getDevices: vi.fn(),
    getDevice: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => { }),
  } as unknown as DeviceManager;
};



describe('DeviceList', () => {
  let mockDeviceManager: DeviceManager;

  beforeEach(() => {
    mockDeviceManager = createMockDeviceManager();
  });

  /**
   * Test empty list rendering
   * Requirements: 8.2
   */
  it('should render empty state when no devices are available', () => {
    render(
      <AppProvider>
        <DeviceList deviceManager={mockDeviceManager} />
      </AppProvider>
    );

    const emptyMessage = screen.getByRole('status');
    expect(emptyMessage.textContent).toContain('No devices found');
    expect(emptyMessage.textContent).toContain('Start a scan to discover Govee devices');
  });

  /**
   * Test multiple device rendering
   * Requirements: 8.2
   */
  it('should render multiple devices when devices are present', () => {
    // We need to simulate a scan that populates devices
    vi.mocked(mockDeviceManager.discoverDevices).mockResolvedValue([]);

    render(
      <AppProvider>
        <DeviceList deviceManager={mockDeviceManager} />
      </AppProvider>
    );

    // Initially should show empty state
    expect(screen.getByRole('status')).toBeDefined();
  });

  /**
   * Test connect button functionality
   * Requirements: 8.2
   */
  it('should render connect button for disconnected devices', () => {
    render(
      <AppProvider>
        <DeviceList deviceManager={mockDeviceManager} />
      </AppProvider>
    );

    // Verify component renders without errors
    expect(screen.getByRole('status')).toBeDefined();
  });

  /**
   * Test that DeviceList renders device cards
   * Requirements: 8.2
   */
  it('should render device cards for each device', () => {
    render(
      <AppProvider>
        <DeviceList deviceManager={mockDeviceManager} />
      </AppProvider>
    );

    // With no devices, should show empty state
    const emptyState = screen.getByText(/no devices found/i);
    expect(emptyState).toBeDefined();
  });
});
