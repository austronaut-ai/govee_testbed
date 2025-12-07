import { describe, it, expect } from 'vitest';
import { appReducer, initialState, AppState, ManagedDevice } from './AppContext';
import { DeviceState } from '../types/device';

describe('appReducer', () => {
  describe('SCAN_START action', () => {
    it('should set scanning to true', () => {
      const action = { type: 'SCAN_START' as const };
      const newState = appReducer(initialState, action);

      expect(newState.scanning).toBe(true);
      expect(newState.devices).toEqual(new Map());
    });

    it('should preserve existing devices when starting scan', () => {
      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Test Device',
        connectionState: 'connected',
        rssi: -50,
        state: { power: true },
      };

      const stateWithDevices: AppState = {
        ...initialState,
        devices: new Map([['device-1', device]]),
      };

      const action = { type: 'SCAN_START' as const };
      const newState = appReducer(stateWithDevices, action);

      expect(newState.scanning).toBe(true);
      expect(newState.devices.get('device-1')).toEqual(device);
    });
  });

  describe('SCAN_COMPLETE action', () => {
    it('should set scanning to false and add discovered devices', () => {
      const devices: ManagedDevice[] = [
        {
          id: 'device-1',
          name: 'Device 1',
          connectionState: 'disconnected',
          rssi: -60,
          state: null,
        },
        {
          id: 'device-2',
          name: 'Device 2',
          connectionState: 'disconnected',
          rssi: -70,
          state: null,
        },
      ];

      const scanningState: AppState = {
        ...initialState,
        scanning: true,
      };

      const action = { type: 'SCAN_COMPLETE' as const, devices };
      const newState = appReducer(scanningState, action);

      expect(newState.scanning).toBe(false);
      expect(newState.devices.size).toBe(2);
      expect(newState.devices.get('device-1')).toEqual(devices[0]);
      expect(newState.devices.get('device-2')).toEqual(devices[1]);
    });

    it('should preserve connection state of existing devices', () => {
      const existingDevice: ManagedDevice = {
        id: 'device-1',
        name: 'Device 1',
        connectionState: 'connected',
        rssi: -60,
        state: { power: true, brightness: 128 },
      };

      const stateWithConnectedDevice: AppState = {
        ...initialState,
        devices: new Map([['device-1', existingDevice]]),
        scanning: true,
      };

      const scannedDevices: ManagedDevice[] = [
        {
          id: 'device-1',
          name: 'Device 1',
          connectionState: 'disconnected',
          rssi: -65,
          state: null,
        },
      ];

      const action = { type: 'SCAN_COMPLETE' as const, devices: scannedDevices };
      const newState = appReducer(stateWithConnectedDevice, action);

      const device = newState.devices.get('device-1');
      expect(device?.connectionState).toBe('connected');
      expect(device?.state).toEqual({ power: true, brightness: 128 });
      expect(device?.rssi).toBe(-65); // RSSI should be updated
    });
  });

  describe('DEVICE_CONNECTED action', () => {
    it('should update device connection state to connected', () => {
      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Test Device',
        connectionState: 'disconnected',
        rssi: -50,
        state: null,
      };

      const stateWithDevice: AppState = {
        ...initialState,
        devices: new Map([['device-1', device]]),
      };

      const action = { type: 'DEVICE_CONNECTED' as const, deviceId: 'device-1' };
      const newState = appReducer(stateWithDevice, action);

      expect(newState.devices.get('device-1')?.connectionState).toBe('connected');
    });

    it('should clear lastError when device connects', () => {
      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Test Device',
        connectionState: 'error',
        rssi: -50,
        state: null,
        lastError: 'Connection failed',
      };

      const stateWithDevice: AppState = {
        ...initialState,
        devices: new Map([['device-1', device]]),
      };

      const action = { type: 'DEVICE_CONNECTED' as const, deviceId: 'device-1' };
      const newState = appReducer(stateWithDevice, action);

      expect(newState.devices.get('device-1')?.connectionState).toBe('connected');
      expect(newState.devices.get('device-1')?.lastError).toBeUndefined();
    });

    it('should return unchanged state if device not found', () => {
      const action = { type: 'DEVICE_CONNECTED' as const, deviceId: 'nonexistent' };
      const newState = appReducer(initialState, action);

      expect(newState).toBe(initialState);
    });
  });

  describe('DEVICE_DISCONNECTED action', () => {
    it('should update device connection state to disconnected', () => {
      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Test Device',
        connectionState: 'connected',
        rssi: -50,
        state: { power: true, brightness: 200 },
      };

      const stateWithDevice: AppState = {
        ...initialState,
        devices: new Map([['device-1', device]]),
      };

      const action = { type: 'DEVICE_DISCONNECTED' as const, deviceId: 'device-1' };
      const newState = appReducer(stateWithDevice, action);

      expect(newState.devices.get('device-1')?.connectionState).toBe('disconnected');
    });

    it('should clear device state when disconnected', () => {
      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Test Device',
        connectionState: 'connected',
        rssi: -50,
        state: { power: true, brightness: 200 },
      };

      const stateWithDevice: AppState = {
        ...initialState,
        devices: new Map([['device-1', device]]),
      };

      const action = { type: 'DEVICE_DISCONNECTED' as const, deviceId: 'device-1' };
      const newState = appReducer(stateWithDevice, action);

      expect(newState.devices.get('device-1')?.state).toBeNull();
    });

    it('should return unchanged state if device not found', () => {
      const action = { type: 'DEVICE_DISCONNECTED' as const, deviceId: 'nonexistent' };
      const newState = appReducer(initialState, action);

      expect(newState).toBe(initialState);
    });
  });

  describe('DEVICE_STATE_UPDATED action', () => {
    it('should update device state', () => {
      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Test Device',
        connectionState: 'connected',
        rssi: -50,
        state: null,
      };

      const stateWithDevice: AppState = {
        ...initialState,
        devices: new Map([['device-1', device]]),
      };

      const newDeviceState: DeviceState = {
        power: true,
        brightness: 150,
        color: { r: 255, g: 0, b: 0 },
      };

      const action = {
        type: 'DEVICE_STATE_UPDATED' as const,
        deviceId: 'device-1',
        state: newDeviceState,
      };
      const newState = appReducer(stateWithDevice, action);

      expect(newState.devices.get('device-1')?.state).toEqual(newDeviceState);
    });

    it('should preserve other device properties when updating state', () => {
      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Test Device',
        connectionState: 'connected',
        rssi: -50,
        state: null,
      };

      const stateWithDevice: AppState = {
        ...initialState,
        devices: new Map([['device-1', device]]),
      };

      const newDeviceState: DeviceState = { power: false };

      const action = {
        type: 'DEVICE_STATE_UPDATED' as const,
        deviceId: 'device-1',
        state: newDeviceState,
      };
      const newState = appReducer(stateWithDevice, action);

      const updatedDevice = newState.devices.get('device-1');
      expect(updatedDevice?.name).toBe('Test Device');
      expect(updatedDevice?.connectionState).toBe('connected');
      expect(updatedDevice?.rssi).toBe(-50);
    });

    it('should return unchanged state if device not found', () => {
      const action = {
        type: 'DEVICE_STATE_UPDATED' as const,
        deviceId: 'nonexistent',
        state: { power: true },
      };
      const newState = appReducer(initialState, action);

      expect(newState).toBe(initialState);
    });
  });

  describe('DEVICE_ERROR action', () => {
    it('should update device connection state to error and set error message', () => {
      const device: ManagedDevice = {
        id: 'device-1',
        name: 'Test Device',
        connectionState: 'connecting',
        rssi: -50,
        state: null,
      };

      const stateWithDevice: AppState = {
        ...initialState,
        devices: new Map([['device-1', device]]),
      };

      const action = {
        type: 'DEVICE_ERROR' as const,
        deviceId: 'device-1',
        error: 'Connection timeout',
      };
      const newState = appReducer(stateWithDevice, action);

      expect(newState.devices.get('device-1')?.connectionState).toBe('error');
      expect(newState.devices.get('device-1')?.lastError).toBe('Connection timeout');
    });

    it('should return unchanged state if device not found', () => {
      const action = {
        type: 'DEVICE_ERROR' as const,
        deviceId: 'nonexistent',
        error: 'Some error',
      };
      const newState = appReducer(initialState, action);

      expect(newState).toBe(initialState);
    });
  });

  describe('TOGGLE_DEBUG_MODE action', () => {
    it('should toggle debug mode from false to true', () => {
      const action = { type: 'TOGGLE_DEBUG_MODE' as const };
      const newState = appReducer(initialState, action);

      expect(newState.debugMode).toBe(true);
    });

    it('should toggle debug mode from true to false', () => {
      const stateWithDebug: AppState = {
        ...initialState,
        debugMode: true,
      };

      const action = { type: 'TOGGLE_DEBUG_MODE' as const };
      const newState = appReducer(stateWithDebug, action);

      expect(newState.debugMode).toBe(false);
    });
  });
});
