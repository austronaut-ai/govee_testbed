
export interface CloudDevice {
    sku: string;
    device: string;
    deviceName: string;
    type: string;
    capabilities: CloudCapability[];
}

export interface CloudCapability {
    type: string;
    instance: string;
    parameters?: any;
}

export class GoveeCloudService {
    private baseUrl = 'https://openapi.api.govee.com';
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async request(endpoint: string, method: string = 'GET', body?: any) {
        const headers = {
            'Govee-API-Key': this.apiKey,
            'Content-Type': 'application/json',
        };

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            throw new Error(`API Request failed: ${response.statusText}`);
        }

        return response.json();
    }

    async getDevices(): Promise<CloudDevice[]> {
        const data = await this.request('/router/api/v1/user/devices');
        return data.data || [];
    }

    async controlDevice(device: CloudDevice, capability: { type: string; instance: string; value: any }) {
        const payload = {
            requestId: crypto.randomUUID(),
            payload: {
                sku: device.sku,
                device: device.device,
                capability
            }
        };

        return this.request('/router/api/v1/device/control', 'POST', payload);
    }

    async setPower(device: CloudDevice, on: boolean) {
        return this.controlDevice(device, {
            type: 'devices.capabilities.on_off',
            instance: 'powerSwitch',
            value: on ? 1 : 0
        });
    }

    async setBrightness(device: CloudDevice, value: number) {
        return this.controlDevice(device, {
            type: 'devices.capabilities.range',
            instance: 'brightness',
            value: value // 0-100
        });
    }

    async setColor(device: CloudDevice, r: number, g: number, b: number) {
        // Combine RGB into a single integer: (R << 16) | (G << 8) | B
        const colorValue = ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);

        return this.controlDevice(device, {
            type: 'devices.capabilities.color_setting',
            instance: 'colorRgb',
            value: colorValue
        });
    }

    async setColorTemperature(device: CloudDevice, kelvin: number) {
        return this.controlDevice(device, {
            type: 'devices.capabilities.color_setting',
            instance: 'colorTemperatureK',
            value: kelvin
        });
    }
}
