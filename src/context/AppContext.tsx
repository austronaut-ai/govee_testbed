import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { DeviceState } from '../types/device';
import type { BLEDevice } from '../services/ble.service';

// Connection state type
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Managed device interface
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

// Application state interface
export interface AppState {
  devices: Map<string, ManagedDevice>;
  scanning: boolean;
  debugMode: boolean;
  selectedDeviceId: string | null;
  apiKey: string | null;
  dashboardMode: 'ble' | 'wifi';
}

// Action types
export type AppAction =
  | { type: 'SCAN_START' }
  | { type: 'SCAN_COMPLETE'; devices: ManagedDevice[] }
  | { type: 'DEVICE_CONNECTED'; deviceId: string }
  | { type: 'DEVICE_DISCONNECTED'; deviceId: string }
  | { type: 'DEVICE_STATE_UPDATED'; deviceId: string; state: DeviceState }
  | { type: 'DEVICE_ERROR'; deviceId: string; error: string }
  | { type: 'TOGGLE_DEBUG_MODE' }
  | { type: 'TOGGLE_DASHBOARD_MODE' }
  | { type: 'SET_API_KEY'; key: string };

// Initial state
export const initialState: AppState = {
  devices: new Map(),
  scanning: false,
  debugMode: false,
  selectedDeviceId: null,
  apiKey: typeof localStorage !== 'undefined' ? localStorage.getItem('govee_api_key') : null,
  dashboardMode: 'ble',
};

// Reducer function
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SCAN_START':
      return {
        ...state,
        scanning: true,
      };

    case 'SCAN_COMPLETE': {
      const newDevices = new Map(state.devices);
      action.devices.forEach((device) => {
        // Preserve existing connection state if device already exists
        const existing = newDevices.get(device.id);
        if (existing) {
          newDevices.set(device.id, {
            ...device,
            connectionState: existing.connectionState,
            state: existing.state,
          });
        } else {
          newDevices.set(device.id, device);
        }
      });
      return {
        ...state,
        devices: newDevices,
        scanning: false,
      };
    }

    case 'DEVICE_CONNECTED': {
      const device = state.devices.get(action.deviceId);
      if (!device) return state;

      const newDevices = new Map(state.devices);
      newDevices.set(action.deviceId, {
        ...device,
        connectionState: 'connected',
        lastError: undefined,
      });
      return {
        ...state,
        devices: newDevices,
      };
    }

    case 'DEVICE_DISCONNECTED': {
      const device = state.devices.get(action.deviceId);
      if (!device) return state;

      const newDevices = new Map(state.devices);
      newDevices.set(action.deviceId, {
        ...device,
        connectionState: 'disconnected',
        state: null,
      });
      return {
        ...state,
        devices: newDevices,
      };
    }

    case 'DEVICE_STATE_UPDATED': {
      const device = state.devices.get(action.deviceId);
      if (!device) return state;

      const newDevices = new Map(state.devices);
      newDevices.set(action.deviceId, {
        ...device,
        state: action.state,
      });
      return {
        ...state,
        devices: newDevices,
      };
    }

    case 'DEVICE_ERROR': {
      const device = state.devices.get(action.deviceId);
      if (!device) return state;

      const newDevices = new Map(state.devices);
      newDevices.set(action.deviceId, {
        ...device,
        connectionState: 'error',
        lastError: action.error,
      });
      return {
        ...state,
        devices: newDevices,
      };
    }

    case 'TOGGLE_DEBUG_MODE':
      return {
        ...state,
        debugMode: !state.debugMode,
      };

    case 'TOGGLE_DASHBOARD_MODE':
      return {
        ...state,
        dashboardMode: state.dashboardMode === 'ble' ? 'wifi' : 'ble',
      };

    case 'SET_API_KEY':
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('govee_api_key', action.key);
      }
      return {
        ...state,
        apiKey: action.key,
      };

    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Custom hook to use the context
function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

// Custom hooks for state access
export function useDevices(): Map<string, ManagedDevice> {
  const { state } = useAppContext();
  return state.devices;
}

export function useScanning(): boolean {
  const { state } = useAppContext();
  return state.scanning;
}

export function useDebugMode(): boolean {
  const { state } = useAppContext();
  return state.debugMode;
}

export function useDashboardMode(): 'ble' | 'wifi' {
  const { state } = useAppContext();
  return state.dashboardMode;
}

export function useApiKey(): string | null {
  const { state } = useAppContext();
  return state.apiKey;
}

export function useAppDispatch(): React.Dispatch<AppAction> {
  const { dispatch } = useAppContext();
  return dispatch;
}
