import React from 'react';

interface ScanButtonProps {
  onScan: () => void;
  isScanning: boolean;
  disabled?: boolean;
}

export function ScanButton({ onScan, isScanning, disabled = false }: ScanButtonProps) {
  return (
    <button
      onClick={onScan}
      disabled={disabled || isScanning}
      className="scan-button"
      aria-label={isScanning ? 'Scanning for devices' : 'Scan for devices'}
    >
      {isScanning ? (
        <>
          <svg className="animate-spin-slow w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Scanning...
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Scan for Devices
        </>
      )}
    </button>
  );
}
