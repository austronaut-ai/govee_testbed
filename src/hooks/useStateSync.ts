// Hook for subscribing to device state updates
import { useEffect } from 'react';
import { DeviceManager, type ManagedDevice } from '../services/device-manager';
import { useAppDispatch } from '../context/AppContext';

/**
 * Hook that subscribes to device state updates from the device manager
 * and propagates them to the application context
 */
export function useStateSync(deviceManager: DeviceManager): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Subscribe to all updates from device manager
    const unsubscribe = deviceManager.subscribe((device: ManagedDevice) => {
      // Dispatch updates based on connection state
      if (device.connectionState === 'connected') {
        // If connected, ensure we have the latest state
        dispatch({
          type: 'DEVICE_CONNECTED',
          deviceId: device.id,
        });

        if (device.state) {
          dispatch({
            type: 'DEVICE_STATE_UPDATED',
            deviceId: device.id,
            state: device.state,
          });
        }
      } else if (device.connectionState === 'disconnected') {
        dispatch({
          type: 'DEVICE_DISCONNECTED',
          deviceId: device.id,
        });
      } else if (device.connectionState === 'error' && device.lastError) {
        dispatch({
          type: 'DEVICE_ERROR',
          deviceId: device.id,
          error: device.lastError,
        });
      }
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, [deviceManager, dispatch]);
}
