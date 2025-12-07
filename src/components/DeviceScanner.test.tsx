import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeviceScanner } from './DeviceScanner';
import { AppProvider } from '../context/AppContext';
import { DeviceManager } from '../services/device-manager';
import { ManagedDevice } from '../services/device-manager';

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
  } as unknown as DeviceManager;
};

describe('DeviceScanner', () => {
  let mockDeviceManager: DeviceManager;

  beforeEach(() => {
    mockDeviceManager = createMockDeviceManager();
  });

  it('should render scan button', () => {
    render(
      <AppProvider>
        <DeviceScanner deviceManager={mockDeviceManager} />
      </AppProvider>
    );

    const scanButton = screen.getByRole('button', { name: /scan for devices/i });
    expect(scanButton).toBeDefined();
  });

  it('should display loading state when scanning', async () => {
    // Mock a delayed response
    vi.mocked(mockDeviceManager.discoverDevices).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
    );

    render(
      <AppProvider>
        <DeviceScanner deviceManager={mockDeviceManager} />
      </AppProvider>
    );

    const scanButton = screen.getByRole('button', { name: /scan for devices/i });
    fireEvent.click(scanButton);

    // Check for scanning feedback
    await waitFor(() => {
      const scanningText = screen.getByText(/searching for govee devices/i);
      expect(scanningText).toBeDefined();
    });

    // Check button shows scanning state
    const scanningButton = screen.getByRole('button', { name: /scanning for devices/i });
    expect(scanningButton).toBeDefined();
    expect(scanningButton.hasAttribute('disabled')).toBe(true);
  });

  it('should display device count after scan completes', async () => {
    const mockDevices: ManagedDevice[] = [
      {
        id: 'device-1',
        name: 'Govee Light 1',
        connectionState: 'disconnected',
        rssi: -60,
        state: null,
      },
      {
        id: 'device-2',
        name: 'Govee Light 2',
        connectionState: 'disconnected',
        rssi: -70,
        state: null,
      },
      {
        id: 'device-3',
        name: 'Govee Light 3',
        connectionState: 'disconnected',
        rssi: -80,
        state: null,
      },
    ];

    vi.mocked(mockDeviceManager.discoverDevices).mockResolvedValue(mockDevices);

    render(
      <AppProvider>
        <DeviceScanner deviceManager={mockDeviceManager} />
      </AppProvider>
    );

    const scanButton = screen.getByRole('button', { name: /scan for devices/i });
    fireEvent.click(scanButton);

    // Wait for scan to complete and device count to appear
    await waitFor(() => {
      const deviceCount = screen.getByText(/found 3 devices/i);
      expect(deviceCount).toBeDefined();
    });

    // Scanning feedback should be gone
    expect(screen.queryByText(/searching for govee devices/i)).toBeNull();
  });

  it('should display singular device count for one device', async () => {
    const mockDevices: ManagedDevice[] = [
      {
        id: 'device-1',
        name: 'Govee Light 1',
        connectionState: 'disconnected',
        rssi: -60,
        state: null,
      },
    ];

    vi.mocked(mockDeviceManager.discoverDevices).mockResolvedValue(mockDevices);

    render(
      <AppProvider>
        <DeviceScanner deviceManager={mockDeviceManager} />
      </AppProvider>
    );

    const scanButton = screen.getByRole('button', { name: /scan for devices/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      const deviceCount = screen.getByText(/found 1 device$/i);
      expect(deviceCount).toBeDefined();
    });
  });

  it('should not display device count when no devices found', async () => {
    vi.mocked(mockDeviceManager.discoverDevices).mockResolvedValue([]);

    render(
      <AppProvider>
        <DeviceScanner deviceManager={mockDeviceManager} />
      </AppProvider>
    );

    const scanButton = screen.getByRole('button', { name: /scan for devices/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(mockDeviceManager.discoverDevices).toHaveBeenCalled();
    });

    // Should not show device count for 0 devices
    expect(screen.queryByText(/found.*device/i)).toBeNull();
  });

  it('should display error message when scan fails', async () => {
    const errorMessage = 'Bluetooth not available';
    vi.mocked(mockDeviceManager.discoverDevices).mockRejectedValue(
      new Error(errorMessage)
    );

    render(
      <AppProvider>
        <DeviceScanner deviceManager={mockDeviceManager} />
      </AppProvider>
    );

    const scanButton = screen.getByRole('button', { name: /scan for devices/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      const errorElement = screen.getByRole('alert');
      expect(errorElement.textContent).toContain(errorMessage);
    });
  });

  it('should call deviceManager.discoverDevices when scan button clicked', async () => {
    vi.mocked(mockDeviceManager.discoverDevices).mockResolvedValue([]);

    render(
      <AppProvider>
        <DeviceScanner deviceManager={mockDeviceManager} />
      </AppProvider>
    );

    const scanButton = screen.getByRole('button', { name: /scan for devices/i });
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(mockDeviceManager.discoverDevices).toHaveBeenCalledTimes(1);
    });
  });
});
