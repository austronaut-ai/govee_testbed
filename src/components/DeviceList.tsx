import React from 'react';
import { DeviceCard } from './DeviceCard';
import { useDevices, useAppDispatch } from '../context/AppContext';
import { DeviceManager } from '../services/device-manager';
import { useStateSync } from '../hooks/useStateSync';
import type { RGB } from '../types/device';

interface DeviceListProps {
  deviceManager: DeviceManager;
}

export function DeviceList({ deviceManager }: DeviceListProps) {
  // Sync device state with context
  useStateSync(deviceManager);

  const devices = useDevices();
  const dispatch = useAppDispatch();

  const handleConnect = async (deviceId: string) => {
    try {
      await deviceManager.connectDevice(deviceId);
      dispatch({ type: 'DEVICE_CONNECTED', deviceId });

      // Read device state after connection
      const state = await deviceManager.getDeviceState(deviceId);
      if (state) {
        dispatch({ type: 'DEVICE_STATE_UPDATED', deviceId, state });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      dispatch({ type: 'DEVICE_ERROR', deviceId, error: errorMessage });
    }
  };

  const handleDisconnect = async (deviceId: string) => {
    try {
      await deviceManager.disconnectDevice(deviceId);
      dispatch({ type: 'DEVICE_DISCONNECTED', deviceId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Disconnection failed';
      dispatch({ type: 'DEVICE_ERROR', deviceId, error: errorMessage });
    }
  };

  const handlePowerToggle = async (deviceId: string) => {
    try {
      const device = deviceManager.getDevice(deviceId);
      if (!device) return;

      const currentPowerState = device.state?.power ?? false;
      const newPowerState = !currentPowerState;
      await deviceManager.setPower(deviceId, newPowerState);

      // Update state
      dispatch({
        type: 'DEVICE_STATE_UPDATED',
        deviceId,
        state: { ...device.state, power: newPowerState },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Power toggle failed';
      dispatch({ type: 'DEVICE_ERROR', deviceId, error: errorMessage });
    }
  };

  const handleBrightnessChange = async (deviceId: string, brightness: number) => {
    try {
      await deviceManager.setBrightness(deviceId, brightness);

      const device = deviceManager.getDevice(deviceId);
      if (device) {
        const currentState = device.state || { power: true }; // Assume on if interacting
        dispatch({
          type: 'DEVICE_STATE_UPDATED',
          deviceId,
          state: { ...currentState, brightness } as any,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Brightness change failed';
      dispatch({ type: 'DEVICE_ERROR', deviceId, error: errorMessage });
    }
  };

  const handleColorChange = async (deviceId: string, color: RGB) => {
    try {
      await deviceManager.setColor(deviceId, color.r, color.g, color.b);

      const device = deviceManager.getDevice(deviceId);
      if (device) {
        const currentState = device.state || { power: true };
        dispatch({
          type: 'DEVICE_STATE_UPDATED',
          deviceId,
          state: { ...currentState, color } as any,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Color change failed';
      dispatch({ type: 'DEVICE_ERROR', deviceId, error: errorMessage });
    }
  };

  const handleColorTemperatureChange = async (deviceId: string, kelvin: number) => {
    try {
      await deviceManager.setColorTemperature(deviceId, kelvin);

      const device = deviceManager.getDevice(deviceId);
      if (device) {
        const currentState = device.state || { power: true };
        dispatch({
          type: 'DEVICE_STATE_UPDATED',
          deviceId,
          state: { ...currentState, colorTemperature: kelvin } as any,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Color temperature change failed';
      dispatch({ type: 'DEVICE_ERROR', deviceId, error: errorMessage });
    }
  };

  // Convert Map to array for rendering
  const deviceArray = Array.from(devices.values());

  if (deviceArray.length === 0) {
    return (
      <div className="device-list-empty" role="status">
        <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-lg">No devices found</p>
        <p className="text-sm text-gray-500">Start a scan to discover Govee devices</p>
      </div>
    );
  }

  return (
    <div className="device-list">
      {deviceArray.map((device) => (
        <div key={device.id} className="device-list-item">
          <DeviceCard
            device={device}
            onPowerToggle={handlePowerToggle}
            onBrightnessChange={handleBrightnessChange}
            onColorChange={handleColorChange}
            onColorTemperatureChange={handleColorTemperatureChange}
          />
          <div className="device-actions">
            {device.connectionState === 'disconnected' || device.connectionState === 'error' ? (
              <button
                className="connect-button"
                onClick={() => handleConnect(device.id)}
                aria-label={`Connect to ${device.name}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Connect
              </button>
            ) : device.connectionState === 'connected' ? (
              <button
                className="disconnect-button"
                onClick={() => handleDisconnect(device.id)}
                aria-label={`Disconnect from ${device.name}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Disconnect
              </button>
            ) : (
              <button className="connect-button" disabled aria-label="Connecting...">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
