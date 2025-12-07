// Device control hooks with throttling and error recovery
import { useCallback, useRef } from 'react';
import { DeviceManager } from '../services/device-manager';
import { createCommandThrottle } from '../utils/throttle';
import { useAppDispatch } from '../context/AppContext';
import type { DeviceState } from '../types/device';

export interface DeviceControlHandlers {
  togglePower: (deviceId: string, currentState: boolean) => Promise<void>;
  setBrightness: (deviceId: string, brightness: number) => void;
  setColor: (deviceId: string, r: number, g: number, b: number) => void;
}

interface UseDeviceControlOptions {
  deviceManager: DeviceManager;
  onError?: (deviceId: string, error: Error) => void;
}

/**
 * Hook that provides device control handlers with throttling and error recovery
 */
export function useDeviceControl(options: UseDeviceControlOptions): DeviceControlHandlers {
  const { deviceManager, onError } = options;
  const dispatch = useAppDispatch();
  
  // Store previous states for error recovery
  const previousStates = useRef<Map<string, DeviceState>>(new Map());

  /**
   * Update device state in context and store previous state
   */
  const updateDeviceState = useCallback((deviceId: string, state: Partial<DeviceState>) => {
    const device = deviceManager.getDevice(deviceId);
    if (device?.state) {
      // Store previous state for recovery
      previousStates.current.set(deviceId, { ...device.state });
      
      // Update with new state
      const newState = { ...device.state, ...state };
      dispatch({
        type: 'DEVICE_STATE_UPDATED',
        deviceId,
        state: newState,
      });
    }
  }, [deviceManager, dispatch]);

  /**
   * Recover to previous state on error
   */
  const recoverState = useCallback((deviceId: string, error: Error) => {
    const previousState = previousStates.current.get(deviceId);
    if (previousState) {
      dispatch({
        type: 'DEVICE_STATE_UPDATED',
        deviceId,
        state: previousState,
      });
    }
    
    dispatch({
      type: 'DEVICE_ERROR',
      deviceId,
      error: error.message,
    });

    if (onError) {
      onError(deviceId, error);
    }
  }, [dispatch, onError]);

  /**
   * Toggle power state with error recovery
   */
  const togglePower = useCallback(async (deviceId: string, currentState: boolean) => {
    const newPowerState = !currentState;
    
    try {
      // Optimistically update UI
      updateDeviceState(deviceId, { power: newPowerState });
      
      // Send command
      await deviceManager.setPower(deviceId, newPowerState);
      
      // Command succeeded, read back state to confirm
      const confirmedState = await deviceManager.getDeviceState(deviceId);
      if (confirmedState) {
        dispatch({
          type: 'DEVICE_STATE_UPDATED',
          deviceId,
          state: confirmedState,
        });
      }
    } catch (error) {
      // Revert to previous state on error
      recoverState(deviceId, error as Error);
      throw error;
    }
  }, [deviceManager, updateDeviceState, recoverState, dispatch]);

  /**
   * Create throttled brightness handler per device
   */
  const brightnessHandlers = useRef<Map<string, (brightness: number) => void>>(new Map());
  
  const setBrightness = useCallback((deviceId: string, brightness: number) => {
    // Get or create throttled handler for this device
    if (!brightnessHandlers.current.has(deviceId)) {
      const handler = createCommandThrottle(async (value: number) => {
        try {
          // Optimistically update UI
          updateDeviceState(deviceId, { brightness: value });
          
          // Send command
          await deviceManager.setBrightness(deviceId, value);
          
          // Command succeeded, read back state to confirm
          const confirmedState = await deviceManager.getDeviceState(deviceId);
          if (confirmedState) {
            dispatch({
              type: 'DEVICE_STATE_UPDATED',
              deviceId,
              state: confirmedState,
            });
          }
        } catch (error) {
          // Revert to previous state on error
          recoverState(deviceId, error as Error);
        }
      }, 100); // 100ms throttle interval
      
      brightnessHandlers.current.set(deviceId, handler);
    }
    
    const handler = brightnessHandlers.current.get(deviceId)!;
    handler(brightness);
  }, [deviceManager, updateDeviceState, recoverState, dispatch]);

  /**
   * Create throttled color handler per device
   */
  const colorHandlers = useRef<Map<string, (r: number, g: number, b: number) => void>>(new Map());
  
  const setColor = useCallback((deviceId: string, r: number, g: number, b: number) => {
    // Get or create throttled handler for this device
    if (!colorHandlers.current.has(deviceId)) {
      const handler = createCommandThrottle(async (red: number, green: number, blue: number) => {
        try {
          // Optimistically update UI
          updateDeviceState(deviceId, { color: { r: red, g: green, b: blue } });
          
          // Send command
          await deviceManager.setColor(deviceId, red, green, blue);
          
          // Command succeeded, read back state to confirm
          const confirmedState = await deviceManager.getDeviceState(deviceId);
          if (confirmedState) {
            dispatch({
              type: 'DEVICE_STATE_UPDATED',
              deviceId,
              state: confirmedState,
            });
          }
        } catch (error) {
          // Revert to previous state on error
          recoverState(deviceId, error as Error);
        }
      }, 100); // 100ms throttle interval
      
      colorHandlers.current.set(deviceId, handler);
    }
    
    const handler = colorHandlers.current.get(deviceId)!;
    handler(r, g, b);
  }, [deviceManager, updateDeviceState, recoverState, dispatch]);

  return {
    togglePower,
    setBrightness,
    setColor,
  };
}
