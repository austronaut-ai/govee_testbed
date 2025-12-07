import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DebugPanel } from './DebugPanel';
import { BLEService } from '../services/ble.service';
import type { ManagedDevice } from '../context/AppContext';
import * as AppContext from '../context/AppContext';

// Mock the context hooks
vi.mock('../context/AppContext', async () => {
  const actual = await vi.importActual('../context/AppContext');
  return {
    ...actual,
    useDebugMode: vi.fn(),
    useDevices: vi.fn(),
  };
});

describe('DebugPanel', () => {
  let bleService: BLEService;

  beforeEach(() => {
    bleService = new BLEService();
    vi.clearAllMocks();
  });

  describe('Conditional Rendering', () => {
    it('should not render when debug mode is disabled', () => {
      vi.mocked(AppContext.useDebugMode).mockReturnValue(false);
      vi.mocked(AppContext.useDevices).mockReturnValue(new Map());

      const { container } = render(<DebugPanel bleService={bleService} />);

      expect(container.firstChild).toBeNull();
    });

    it('should render when debug mode is enabled', () => {
      vi.mocked(AppContext.useDebugMode).mockReturnValue(true);
      vi.mocked(AppContext.useDevices).mockReturnValue(new Map());

      render(<DebugPanel bleService={bleService} />);

      expect(screen.getByTestId('debug-panel')).toBeInTheDocument();
      expect(screen.getByText('Debug Panel')).toBeInTheDocument();
    });

    it('should display "No connected devices" when no devices are connected', () => {
      vi.mocked(AppContext.useDebugMode).mockReturnValue(true);
      vi.mocked(AppContext.useDevices).mockReturnValue(new Map());

      render(<DebugPanel bleService={bleService} />);

      expect(screen.getByText('No connected devices')).toBeInTheDocument();
    });
  });

  describe('Service and Characteristic Display', () => {
    it('should display connected devices in the select dropdown', () => {
      vi.mocked(AppContext.useDebugMode).mockReturnValue(true);

      const device1: ManagedDevice = {
        id: 'device-1',
        name: 'Govee Light 1',
        connectionState: 'connected',
        rssi: -50,
        state: null,
      };

      const device2: ManagedDevice = {
        id: 'device-2',
        name: 'Govee Light 2',
        connectionState: 'connected',
        rssi: -60,
        state: null,
      };

      const devicesMap = new Map([
        ['device-1', device1],
        ['device-2', device2],
      ]);

      vi.mocked(AppContext.useDevices).mockReturnValue(devicesMap);

      render(<DebugPanel bleService={bleService} />);

      const select = screen.getByTestId('device-select') as HTMLSelectElement;
      expect(select).toBeInTheDocument();

      // Check that both devices are in the dropdown
      expect(screen.getByText('Govee Light 1 (device-1)')).toBeInTheDocument();
      expect(screen.getByText('Govee Light 2 (device-2)')).toBeInTheDocument();
    });

    it('should not display disconnected devices in the select dropdown', () => {
      vi.mocked(AppContext.useDebugMode).mockReturnValue(true);

      const connectedDevice: ManagedDevice = {
        id: 'device-1',
        name: 'Govee Light 1',
        connectionState: 'connected',
        rssi: -50,
        state: null,
      };

      const disconnectedDevice: ManagedDevice = {
        id: 'device-2',
        name: 'Govee Light 2',
        connectionState: 'disconnected',
        rssi: -60,
        state: null,
      };

      const devicesMap = new Map([
        ['device-1', connectedDevice],
        ['device-2', disconnectedDevice],
      ]);

      vi.mocked(AppContext.useDevices).mockReturnValue(devicesMap);

      render(<DebugPanel bleService={bleService} />);

      expect(screen.getByText('Govee Light 1 (device-1)')).toBeInTheDocument();
      expect(screen.queryByText('Govee Light 2 (device-2)')).not.toBeInTheDocument();
    });

    it('should display services and characteristics when device is selected', async () => {
      vi.mocked(AppContext.useDebugMode).mockReturnValue(true);

      const mockBleDevice = {
        id: 'device-1',
        name: 'Govee Light 1',
        rssi: -50,
        device: {} as BluetoothDevice,
        server: {
          connected: true,
          getPrimaryService: vi.fn().mockResolvedValue({
            getCharacteristics: vi.fn().mockResolvedValue([
              {
                uuid: '00010203-0405-0607-0809-0a0b0c0d2b11',
                properties: {
                  read: true,
                  write: true,
                  writeWithoutResponse: true,
                  notify: false,
                },
              },
            ]),
            getCharacteristic: vi.fn().mockResolvedValue({
              uuid: '00010203-0405-0607-0809-0a0b0c0d2b11',
              properties: { notify: true },
              addEventListener: vi.fn(),
              removeEventListener: vi.fn(),
              startNotifications: vi.fn().mockResolvedValue(undefined),
              stopNotifications: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        } as any,
      };

      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Govee Light 1',
        connectionState: 'connected',
        rssi: -50,
        state: null,
        bleDevice: mockBleDevice,
      };

      const devicesMap = new Map([['device-1', device]]);
      vi.mocked(AppContext.useDevices).mockReturnValue(devicesMap);

      render(<DebugPanel bleService={bleService} />);

      const select = screen.getByTestId('device-select') as HTMLSelectElement;
      await userEvent.selectOptions(select, 'device-1');

      await waitFor(() => {
        expect(screen.getByTestId('services-list')).toBeInTheDocument();
      });

      expect(screen.getByText(/00010203-0405-0607-0809-0a0b0c0d1910/)).toBeInTheDocument();
      expect(screen.getByText(/00010203-0405-0607-0809-0a0b0c0d2b11/)).toBeInTheDocument();
      expect(screen.getByText(/read, write, writeWithoutResponse/)).toBeInTheDocument();
    });
  });

  describe('Debug Mode Toggle Integration', () => {
    it('should respond to debug mode changes', () => {
      vi.mocked(AppContext.useDebugMode).mockReturnValue(false);
      vi.mocked(AppContext.useDevices).mockReturnValue(new Map());

      const { rerender } = render(<DebugPanel bleService={bleService} />);

      expect(screen.queryByTestId('debug-panel')).not.toBeInTheDocument();

      // Simulate debug mode being enabled
      vi.mocked(AppContext.useDebugMode).mockReturnValue(true);
      rerender(<DebugPanel bleService={bleService} />);

      expect(screen.getByTestId('debug-panel')).toBeInTheDocument();
    });
  });

  describe('Raw Read/Write Controls', () => {
    it('should display read and write controls when device is selected', async () => {
      vi.mocked(AppContext.useDebugMode).mockReturnValue(true);

      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Govee Light 1',
        connectionState: 'connected',
        rssi: -50,
        state: null,
        bleDevice: {
          id: 'device-1',
          name: 'Govee Light 1',
          rssi: -50,
          device: {} as BluetoothDevice,
          server: { connected: true } as any,
        },
      };

      const devicesMap = new Map([['device-1', device]]);
      vi.mocked(AppContext.useDevices).mockReturnValue(devicesMap);

      render(<DebugPanel bleService={bleService} />);

      const select = screen.getByTestId('device-select') as HTMLSelectElement;
      await userEvent.selectOptions(select, 'device-1');

      expect(screen.getByTestId('read-button')).toBeInTheDocument();
      expect(screen.getByTestId('write-input')).toBeInTheDocument();
      expect(screen.getByTestId('write-button')).toBeInTheDocument();
    });

    it('should disable write button when input is empty', async () => {
      vi.mocked(AppContext.useDebugMode).mockReturnValue(true);

      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Govee Light 1',
        connectionState: 'connected',
        rssi: -50,
        state: null,
        bleDevice: {
          id: 'device-1',
          name: 'Govee Light 1',
          rssi: -50,
          device: {} as BluetoothDevice,
          server: { connected: true } as any,
        },
      };

      const devicesMap = new Map([['device-1', device]]);
      vi.mocked(AppContext.useDevices).mockReturnValue(devicesMap);

      render(<DebugPanel bleService={bleService} />);

      const select = screen.getByTestId('device-select') as HTMLSelectElement;
      await userEvent.selectOptions(select, 'device-1');

      const writeButton = screen.getByTestId('write-button') as HTMLButtonElement;
      expect(writeButton).toBeDisabled();
    });

    it('should enable write button when input has value', async () => {
      vi.mocked(AppContext.useDebugMode).mockReturnValue(true);

      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Govee Light 1',
        connectionState: 'connected',
        rssi: -50,
        state: null,
        bleDevice: {
          id: 'device-1',
          name: 'Govee Light 1',
          rssi: -50,
          device: {} as BluetoothDevice,
          server: { connected: true } as any,
        },
      };

      const devicesMap = new Map([['device-1', device]]);
      vi.mocked(AppContext.useDevices).mockReturnValue(devicesMap);

      render(<DebugPanel bleService={bleService} />);

      const select = screen.getByTestId('device-select') as HTMLSelectElement;
      await userEvent.selectOptions(select, 'device-1');

      const writeInput = screen.getByTestId('write-input') as HTMLInputElement;
      await userEvent.type(writeInput, '33 01 00');

      const writeButton = screen.getByTestId('write-button') as HTMLButtonElement;
      expect(writeButton).not.toBeDisabled();
    });
  });

  describe('Command Logging', () => {
    it('should display "No commands logged" initially', () => {
      vi.mocked(AppContext.useDebugMode).mockReturnValue(true);
      vi.mocked(AppContext.useDevices).mockReturnValue(new Map());

      render(<DebugPanel bleService={bleService} />);

      expect(screen.getByText('No commands logged')).toBeInTheDocument();
    });

    it('should log commands after read operation', async () => {
      vi.mocked(AppContext.useDebugMode).mockReturnValue(true);

      const mockDataView = new DataView(new ArrayBuffer(20));
      mockDataView.setUint8(0, 0x33);
      mockDataView.setUint8(1, 0x01);

      vi.spyOn(bleService, 'readCharacteristic').mockResolvedValue(mockDataView);

      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Govee Light 1',
        connectionState: 'connected',
        rssi: -50,
        state: null,
        bleDevice: {
          id: 'device-1',
          name: 'Govee Light 1',
          rssi: -50,
          device: {} as BluetoothDevice,
          server: { connected: true } as any,
        },
      };

      const devicesMap = new Map([['device-1', device]]);
      vi.mocked(AppContext.useDevices).mockReturnValue(devicesMap);

      render(<DebugPanel bleService={bleService} />);

      const select = screen.getByTestId('device-select') as HTMLSelectElement;
      await userEvent.selectOptions(select, 'device-1');

      const readButton = screen.getByTestId('read-button');
      await userEvent.click(readButton);

      await waitFor(() => {
        expect(screen.getByTestId('command-logs')).toBeInTheDocument();
      });

      expect(screen.getByText('Govee Light 1')).toBeInTheDocument();
    });
  });
});
