import React from 'react';
import { ConnectionStatus } from './ConnectionStatus';
import { SignalStrength } from './SignalStrength';
import { DeviceControls } from './DeviceControls';
import type { ManagedDevice } from '../context/AppContext';
import type { RGB } from '../types/device';

interface DeviceCardProps {
  device: ManagedDevice;
  onPowerToggle: (deviceId: string) => void;
  onBrightnessChange: (deviceId: string, value: number) => void;
  onColorChange: (deviceId: string, color: RGB) => void;
  onColorTemperatureChange: (deviceId: string, kelvin: number) => void;
}

export function DeviceCard({
  device,
  onPowerToggle,
  onBrightnessChange,
  onColorChange,
  onColorTemperatureChange,
}: DeviceCardProps) {
  const handlePowerToggle = () => {
    onPowerToggle(device.id);
  };

  const handleBrightnessChange = (value: number) => {
    onBrightnessChange(device.id, value);
  };

  const handleColorChange = (color: RGB) => {
    onColorChange(device.id, color);
  };

  const handleColorTemperatureChange = (kelvin: number) => {
    onColorTemperatureChange(device.id, kelvin);
  };

  return (
    <div className="device-card" data-device-id={device.id}>
      <div className="device-header">
        <h3 className="device-name">{device.name}</h3>
        <div className="device-info">
          <ConnectionStatus connectionState={device.connectionState} />
          <SignalStrength
            rssi={device.rssi}
            isWeak={device.connectionQuality?.isWeak}
            isOutOfRange={device.connectionQuality?.isOutOfRange}
          />
        </div>
      </div>

      {device.lastError && (
        <div className="device-error" role="alert">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>Error: {device.lastError}</span>
        </div>
      )}

      <DeviceControls
        deviceId={device.id}
        connectionState={device.connectionState}
        state={device.state}
        onPowerToggle={handlePowerToggle}
        onBrightnessChange={handleBrightnessChange}
        onColorChange={handleColorChange}
        onColorTemperatureChange={handleColorTemperatureChange}
      />
    </div>
  );
}
