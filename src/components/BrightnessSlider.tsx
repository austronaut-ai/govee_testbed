import React from 'react';

interface BrightnessSliderProps {
  brightness: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

export function BrightnessSlider({ brightness, disabled, onChange }: BrightnessSliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const percentage = Math.round((brightness / 255) * 100);

  return (
    <div className="brightness-slider">
      <label htmlFor="brightness-input" className="brightness-label">
        <span className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Brightness
        </span>
        <span className="font-mono text-sm">{percentage}%</span>
      </label>
      <input
        id="brightness-input"
        type="range"
        min="0"
        max="255"
        value={brightness}
        onChange={handleChange}
        disabled={disabled}
        className="slider"
        aria-label="Brightness control"
        aria-valuemin={0}
        aria-valuemax={255}
        aria-valuenow={brightness}
      />
    </div>
  );
}
