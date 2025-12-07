import React from 'react';

interface SignalStrengthProps {
  rssi: number;
  isWeak?: boolean;
  isOutOfRange?: boolean;
}

export function SignalStrength({ rssi, isWeak = false, isOutOfRange = false }: SignalStrengthProps) {
  // RSSI typically ranges from -100 (weak) to -30 (strong)
  const getSignalLevel = (rssi: number): 'weak' | 'medium' | 'strong' => {
    if (rssi >= -50) return 'strong';
    if (rssi >= -70) return 'medium';
    return 'weak';
  };

  const signalLevel = getSignalLevel(rssi);
  const signalClass = `signal-${signalLevel}`;

  const getSignalIcon = () => {
    if (signalLevel === 'strong') {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
      );
    } else if (signalLevel === 'medium') {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5z" />
        </svg>
      );
    }
  };

  return (
    <div className={`signal-strength ${signalClass}`} title={`Signal: ${rssi} dBm`}>
      {getSignalIcon()}
      <span className="signal-value">{rssi} dBm</span>
      {/* Requirement 9.3: Display warning indicator for weak signals */}
      {isWeak && !isOutOfRange && (
        <svg className="signal-warning w-4 h-4" fill="currentColor" viewBox="0 0 20 20" title="Weak signal" role="alert">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )}
      {/* Requirement 9.4: Display out-of-range indicator */}
      {isOutOfRange && (
        <svg className="signal-out-of-range w-4 h-4" fill="currentColor" viewBox="0 0 20 20" title="Out of range" role="alert">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      )}
    </div>
  );
}
