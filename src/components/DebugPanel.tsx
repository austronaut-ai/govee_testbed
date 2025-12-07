import React, { useState, useEffect } from 'react';
import { useDebugMode, useDevices } from '../context/AppContext';
import { BLEService, GOVEE_SERVICE_UUID, GOVEE_CONTROL_CHAR_UUID } from '../services/ble.service';

interface DebugPanelProps {
  bleService: BLEService;
}

interface ServiceInfo {
  uuid: string;
  characteristics: CharacteristicInfo[];
}

interface CharacteristicInfo {
  uuid: string;
  properties: string[];
  value?: string;
}

interface CommandLog {
  timestamp: Date;
  deviceId: string;
  deviceName: string;
  direction: 'sent' | 'received';
  bytes: string;
}

export function DebugPanel({ bleService }: DebugPanelProps) {
  const debugMode = useDebugMode();
  const devices = useDevices();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([]);
  const [characteristicValue, setCharacteristicValue] = useState<string>('');
  const [readValue, setReadValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Get connected devices
  const connectedDevices = Array.from(devices.values()).filter(
    (device) => device.connectionState === 'connected'
  );

  // Load services and characteristics when device is selected
  useEffect(() => {
    if (!selectedDeviceId) {
      setServices([]);
      return;
    }

    const loadServices = async () => {
      try {
        setError(null);
        const device = devices.get(selectedDeviceId);
        if (!device || !device.bleDevice?.server?.connected) {
          setServices([]);
          return;
        }

        const bleDevice = device.bleDevice;
        const server = bleDevice.server;
        if (!server) {
          throw new Error('Device not connected (no server)');
        }

        // Get primary service
        const service = await server.getPrimaryService(GOVEE_SERVICE_UUID);
        const characteristics = await service.getCharacteristics();

        const characteristicInfos: CharacteristicInfo[] = [];
        for (const char of characteristics) {
          const properties: string[] = [];
          if (char.properties.read) properties.push('read');
          if (char.properties.write) properties.push('write');
          if (char.properties.writeWithoutResponse) properties.push('writeWithoutResponse');
          if (char.properties.notify) properties.push('notify');

          characteristicInfos.push({
            uuid: char.uuid,
            properties,
          });
        }

        setServices([
          {
            uuid: GOVEE_SERVICE_UUID,
            characteristics: characteristicInfos,
          },
        ]);

        // Subscribe to notifications for logging
        await bleService.subscribeToCharacteristic(
          bleDevice,
          GOVEE_SERVICE_UUID,
          GOVEE_CONTROL_CHAR_UUID,
          (data) => {
            const bytes = Array.from(new Uint8Array(data.buffer))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join(' ');
            addCommandLog(selectedDeviceId, device.name, 'received', bytes);
          }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load services');
        setServices([]);
      }
    };

    loadServices();
  }, [selectedDeviceId, devices, bleService]);

  const handleReadCharacteristic = async () => {
    if (!selectedDeviceId) return;

    try {
      setError(null);
      const device = devices.get(selectedDeviceId);
      if (!device || !device.bleDevice) {
        setError('Device not found');
        return;
      }

      const data = await bleService.readCharacteristic(
        device.bleDevice,
        GOVEE_SERVICE_UUID,
        GOVEE_CONTROL_CHAR_UUID
      );

      const bytes = Array.from(new Uint8Array(data.buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');

      setReadValue(bytes);

      // Log the read
      addCommandLog(selectedDeviceId, device.name, 'received', bytes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read characteristic');
    }
  };

  const handleWriteCharacteristic = async () => {
    if (!selectedDeviceId || !characteristicValue.trim()) return;

    try {
      setError(null);
      const device = devices.get(selectedDeviceId);
      if (!device || !device.bleDevice) {
        setError('Device not found');
        return;
      }

      // Parse hex string to bytes
      const hexBytes = characteristicValue.trim().split(/\s+/);
      const bytes = new Uint8Array(
        hexBytes.map((hex) => parseInt(hex, 16))
      );

      await bleService.writeCharacteristic(
        device.bleDevice,
        GOVEE_SERVICE_UUID,
        GOVEE_CONTROL_CHAR_UUID,
        bytes
      );

      // Log the write
      addCommandLog(selectedDeviceId, device.name, 'sent', characteristicValue.trim());
      setCharacteristicValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to write characteristic');
    }
  };

  const addCommandLog = (deviceId: string, deviceName: string, direction: 'sent' | 'received', bytes: string) => {
    const log: CommandLog = {
      timestamp: new Date(),
      deviceId,
      deviceName,
      direction,
      bytes,
    };
    setCommandLogs((prev) => [log, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  if (!debugMode) {
    return null;
  }

  return (
    <div className="debug-panel" data-testid="debug-panel">
      <h2 className="debug-panel-title">Debug Panel</h2>

      {/* Device Selection */}
      <div className="debug-section">
        <h3>Select Device</h3>
        {connectedDevices.length === 0 ? (
          <p className="debug-info">No connected devices</p>
        ) : (
          <select
            className="debug-device-select"
            value={selectedDeviceId || ''}
            onChange={(e) => setSelectedDeviceId(e.target.value || null)}
            data-testid="device-select"
          >
            <option value="">-- Select a device --</option>
            {connectedDevices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} ({device.id})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Services and Characteristics */}
      {selectedDeviceId && (
        <div className="debug-section">
          <h3>BLE Services & Characteristics</h3>
          {services.length === 0 ? (
            <p className="debug-info">No services found</p>
          ) : (
            <div className="services-list" data-testid="services-list">
              {services.map((service) => (
                <div key={service.uuid} className="service-item">
                  <div className="service-uuid">
                    <strong>Service:</strong> {service.uuid}
                  </div>
                  <div className="characteristics-list">
                    {service.characteristics.map((char) => (
                      <div key={char.uuid} className="characteristic-item">
                        <div className="characteristic-uuid">
                          <strong>Characteristic:</strong> {char.uuid}
                        </div>
                        <div className="characteristic-properties">
                          <strong>Properties:</strong> {char.properties.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raw Read/Write Controls */}
      {selectedDeviceId && (
        <div className="debug-section">
          <h3>Raw Characteristic Controls</h3>
          <div className="debug-controls">
            <button
              className="debug-button"
              onClick={handleReadCharacteristic}
              data-testid="read-button"
            >
              Read Characteristic
            </button>
            {readValue && (
              <div className="debug-value" data-testid="read-value">
                <strong>Read Value:</strong> {readValue}
              </div>
            )}
          </div>

          <div className="debug-controls">
            <input
              type="text"
              className="debug-input"
              placeholder="Enter hex bytes (e.g., 33 01 00 ...)"
              value={characteristicValue}
              onChange={(e) => setCharacteristicValue(e.target.value)}
              data-testid="write-input"
            />
            <button
              className="debug-button"
              onClick={handleWriteCharacteristic}
              disabled={!characteristicValue.trim()}
              data-testid="write-button"
            >
              Write Characteristic
            </button>
          </div>
        </div>
      )}

      {/* Command Logs */}
      <div className="debug-section">
        <h3>Command Log</h3>
        {commandLogs.length === 0 ? (
          <p className="debug-info">No commands logged</p>
        ) : (
          <div className="command-logs" data-testid="command-logs">
            {commandLogs.map((log, index) => (
              <div key={index} className={`command-log-item ${log.direction}`}>
                <div className="log-timestamp">
                  {log.timestamp.toLocaleTimeString()}
                </div>
                <div className="log-device">{log.deviceName}</div>
                <div className="log-direction">
                  {log.direction === 'sent' ? '→' : '←'}
                </div>
                <div className="log-bytes">{log.bytes}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="debug-error" role="alert" data-testid="debug-error">
          Error: {error}
        </div>
      )}
    </div>
  );
}
