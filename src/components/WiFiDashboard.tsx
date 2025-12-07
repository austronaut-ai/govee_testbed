
import React, { useState, useEffect } from 'react';
import { useApiKey, useAppDispatch } from '../context/AppContext';
import { GoveeCloudService, type CloudDevice } from '../services/cloud-service';
import { DeviceControls } from './DeviceControls';
import type { DeviceState, RGB } from '../types/device';

export function WiFiDashboard() {
    const apiKey = useApiKey();
    const dispatch = useAppDispatch();
    const [inputKey, setInputKey] = useState('');
    const [devices, setDevices] = useState<CloudDevice[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Local state cache for UI feedback (since API doesn't push updates)
    const [deviceStates, setDeviceStates] = useState<Map<string, DeviceState>>(new Map());

    const service = React.useMemo(() =>
        apiKey ? new GoveeCloudService(apiKey) : null,
        [apiKey]);

    useEffect(() => {
        if (service) {
            loadDevices();
        }
    }, [service]);

    const loadDevices = async () => {
        if (!service) return;
        setLoading(true);
        setError(null);
        try {
            const fetchedDevices = await service.getDevices();
            setDevices(fetchedDevices);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load devices');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKey = () => {
        if (inputKey.trim()) {
            dispatch({ type: 'SET_API_KEY', key: inputKey.trim() });
        }
    };

    const updateLocalState = (deviceId: string, update: Partial<DeviceState>) => {
        setDeviceStates(prev => {
            const next = new Map(prev);
            const current = next.get(deviceId) || { power: false, brightness: 100, color: { r: 255, g: 255, b: 255 } };
            next.set(deviceId, { ...current, ...update });
            return next;
        });
    };

    const handlePower = async (device: CloudDevice) => {
        if (!service) return;
        try {
            const currentState = deviceStates.get(device.device)?.power ?? false;
            await service.setPower(device, !currentState);
            updateLocalState(device.device, { power: !currentState });
        } catch (err) {
            setError(`Failed to toggle power: ${err}`);
        }
    };

    const handleBrightness = async (device: CloudDevice, value: number) => {
        if (!service) return;
        try {
            await service.setBrightness(device, value);
            updateLocalState(device.device, { brightness: value });
        } catch (err) {
            setError(`Failed to set brightness: ${err}`);
        }
    };

    const handleColor = async (device: CloudDevice, color: RGB) => {
        if (!service) return;
        try {
            await service.setColor(device, color.r, color.g, color.b);
            updateLocalState(device.device, { color });
        } catch (err) {
            setError(`Failed to set color: ${err}`);
        }
    };

    const handleTemp = async (device: CloudDevice, kelvin: number) => {
        if (!service) return;
        try {
            await service.setColorTemperature(device, kelvin);
            updateLocalState(device.device, { colorTemperature: kelvin });
        } catch (err) {
            setError(`Failed to set color temperature: ${err}`);
        }
    };

    if (!apiKey) {
        return (
            <div className="wifi-login p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">Govee Cloud API</h2>
                <p className="mb-4">Enter your Govee API Key to access WiFi devices.</p>
                <div className="flex gap-2 justify-center">
                    <input
                        type="text"
                        value={inputKey}
                        onChange={e => setInputKey(e.target.value)}
                        className="border p-2 rounded w-64 text-black"
                        placeholder="API Key"
                    />
                    <button
                        onClick={handleSaveKey}
                        className="bg-blue-600 px-4 py-2 rounded text-white"
                    >
                        Save
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="wifi-dashboard font-sans">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">WiFi Devices</h2>
                <button onClick={loadDevices} className="text-sm bg-gray-700 px-3 py-1 rounded">
                    Refresh
                </button>
            </div>

            {error && (
                <div className="bg-red-900/50 p-4 rounded mb-4 text-red-100">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="text-center py-8 opacity-50">Loading devices...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {devices.map(device => (
                        <div key={device.device} className="wifi-card bg-gray-800 rounded-lg p-4">
                            <div className="mb-4">
                                <h3 className="font-bold text-lg">{device.deviceName}</h3>
                                <div className="text-xs text-gray-400">{device.sku}</div>
                            </div>

                            <DeviceControls
                                deviceId={device.device}
                                connectionState="connected"
                                state={deviceStates.get(device.device) || { power: false, brightness: 100, color: { r: 255, g: 255, b: 255 } }}
                                onPowerToggle={() => handlePower(device)}
                                onBrightnessChange={(val) => handleBrightness(device, val)}
                                onColorChange={(c) => handleColor(device, c)}
                                onColorTemperatureChange={(k) => handleTemp(device, k)}
                            />
                        </div>
                    ))}
                    {devices.length === 0 && (
                        <p className="text-center text-gray-400 col-span-full">No devices found on account.</p>
                    )}
                </div>
            )}
        </div>
    );
}
