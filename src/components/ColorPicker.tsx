import React from 'react';
import type { RGB } from '../types/device';

interface ColorPickerProps {
  color: RGB;
  disabled: boolean;
  onChange: (color: RGB) => void;
}

export function ColorPicker({ color, disabled, onChange }: ColorPickerProps) {
  // Convert RGB to hex for color input
  const rgbToHex = (rgb: RGB): string => {
    const toHex = (n: number) => {
      const hex = Math.max(0, Math.min(255, n)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  };

  // Convert hex to RGB
  const hexToRgb = (hex: string): RGB => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rgb = hexToRgb(e.target.value);
    onChange(rgb);
  };

  const hexValue = rgbToHex(color);

  return (
    <div className="color-picker">
      <label htmlFor="color-input" className="color-label">
        <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        Color
      </label>
      <div className="color-input-wrapper">
        <input
          id="color-input"
          type="color"
          value={hexValue}
          onChange={handleChange}
          disabled={disabled}
          className="color-input"
          aria-label="Color picker"
        />
        <span className="color-value">
          RGB({color.r}, {color.g}, {color.b})
        </span>
      </div>
    </div>
  );
}
