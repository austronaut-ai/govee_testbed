import React, { useState } from 'react';
import { ScanButton } from './ScanButton';
import { useScanning, useDevices, useAppDispatch } from '../context/AppContext';
import { DeviceManager } from '../services/device-manager';

interface DeviceScannerProps {
  deviceManager: DeviceManager;
}

export function DeviceScanner({ deviceManager }: DeviceScannerProps) {
  const isScanning = useScanning();
  const devices = useDevices();
  const dispatch = useAppDispatch();
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    try {
      setError(null);
      dispatch({ type: 'SCAN_START' });
      
      const discoveredDevices = await deviceManager.discoverDevices();
      
      dispatch({ 
        type: 'SCAN_COMPLETE', 
        devices: discoveredDevices 
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      dispatch({ 
        type: 'SCAN_COMPLETE', 
        devices: [] 
      });
    }
  };

  const deviceCount = devices.size;

  return (
    <div className="device-scanner">
      <ScanButton onScan={handleScan} isScanning={isScanning} />
      
      {isScanning && (
        <div className="scanning-feedback" role="status" aria-live="polite">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Searching for Govee devices...
        </div>
      )}
      
      {!isScanning && deviceCount > 0 && (
        <div className="device-count" role="status" aria-live="polite">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          Found {deviceCount} device{deviceCount !== 1 ? 's' : ''}
        </div>
      )}
      
      {error && (
        <div className="scan-error" role="alert">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
