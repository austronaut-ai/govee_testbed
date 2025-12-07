import React from 'react';
import { PowerToggle } from './PowerToggle';
import { BrightnessSlider } from './BrightnessSlider';
import { ColorPicker } from './ColorPicker';
import type { DeviceState, RGB } from '../types/device';
import type { ConnectionState } from '../context/AppContext';

interface DeviceControlsProps {
  deviceId: string;
  connectionState: ConnectionState;
  state: DeviceState | null;
  onPowerToggle: () => void;
  onBrightnessChange: (value: number) => void;
  onColorChange: (color: RGB) => void;
  onColorTemperatureChange: (kelvin: number) => void;
}

export function DeviceControls({
  deviceId,
  connectionState,
  state,
  onPowerToggle,
  onBrightnessChange,
  onColorChange,
  onColorTemperatureChange,
}: DeviceControlsProps) {
  const [activeTab, setActiveTab] = React.useState<'color' | 'white'>('color');
  const isConnected = connectionState === 'connected';
  const isDisabled = !isConnected;

  // Default values if state is null
  const power = state?.power ?? false;
  const brightness = state?.brightness ?? 0;
  const color = state?.color ?? { r: 0, g: 0, b: 0 };
  const colorTemperature = state?.colorTemperature ?? 6000;

  // Determine device capabilities based on state properties
  const supportsBrightness = state?.brightness !== undefined;
  const supportsColor = state?.color !== undefined;

  // Preset Colors
  const presets = [
    { name: 'Red', r: 255, g: 0, b: 0 },
    { name: 'Green', r: 0, g: 255, b: 0 },
    { name: 'Blue', r: 0, g: 0, b: 255 },
    { name: 'Yellow', r: 255, g: 255, b: 0 },
    { name: 'Cyan', r: 0, g: 255, b: 255 },
    { name: 'Magenta', r: 255, g: 0, b: 255 },
    { name: 'White', r: 255, g: 255, b: 255 },
  ];

  return (
    <div className="device-controls">
      {/* Power control - always available */}
      <PowerToggle power={power} disabled={isDisabled} onToggle={onPowerToggle} />

      {/* Brightness control - conditional on capability */}
      {supportsBrightness && (
        <BrightnessSlider
          brightness={brightness}
          disabled={isDisabled}
          onChange={onBrightnessChange}
        />
      )}

      {/* Mode Switcher Tabs */}
      {supportsColor && (
        <div className="control-tabs">
          <button
            className={`tab-button ${activeTab === 'color' ? 'active' : ''}`}
            onClick={() => setActiveTab('color')}
            disabled={isDisabled}
          >
            Color
          </button>
          <button
            className={`tab-button ${activeTab === 'white' ? 'active' : ''}`}
            onClick={() => setActiveTab('white')}
            disabled={isDisabled}
          >
            White Mode
          </button>
        </div>
      )}

      {/* Color Controls */}
      {supportsColor && activeTab === 'color' && (
        <div className="color-control-section">
          <ColorPicker color={color} disabled={isDisabled} onChange={onColorChange} />

          <div className="color-presets">
            <span className="info-label">Presets</span>
            <div className="preset-grid">
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  className="preset-swatch"
                  style={{ backgroundColor: `rgb(${preset.r}, ${preset.g}, ${preset.b})` }}
                  onClick={() => onColorChange(preset)}
                  disabled={isDisabled}
                  aria-label={`Set color to ${preset.name}`}
                  title={preset.name}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* White Mode Controls */}
      {supportsColor && activeTab === 'white' && (
        <div className="white-control-section">
          <div className="control-group">
            <div className="label-row">
              <span className="control-icon">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              <span className="control-label">Color Temperature</span>
              <span className="control-value">{colorTemperature}K</span>
            </div>
            <input
              type="range"
              min="2000"
              max="9000"
              step="100"
              value={colorTemperature}
              disabled={isDisabled}
              onChange={(e) => onColorTemperatureChange(Number(e.target.value))}
              className="range-slider temperature-slider"
            />
            <div className="range-labels">
              <span>Warm</span>
              <span>Cool</span>
            </div>
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="controls-disabled-message" role="status">
          Connect to device to enable controls
        </div>
      )}
    </div>
  );
}
