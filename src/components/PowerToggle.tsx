import React from 'react';

interface PowerToggleProps {
  power: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export function PowerToggle({ power, disabled, onToggle }: PowerToggleProps) {
  return (
    <div className="power-toggle">
      <label htmlFor="power-switch" className="power-label">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Power
      </label>
      <button
        id="power-switch"
        className={`toggle-button ${power ? 'on' : 'off'}`}
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={power}
        aria-label={`Turn ${power ? 'off' : 'on'}`}
      >
        {power ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )}
        <span className="toggle-text">{power ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  );
}
