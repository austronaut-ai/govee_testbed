
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoveeCloudService, type CloudDevice } from './cloud-service';

describe('GoveeCloudService', () => {
    let service: GoveeCloudService;
    const apiKey = 'test_api_key';

    // Mock fetch global
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    beforeEach(() => {
        service = new GoveeCloudService(apiKey);
        fetchMock.mockReset();
    });

    describe('getDevices', () => {
        it('should fetch devices successfully', async () => {
            const mockDevices: CloudDevice[] = [
                { sku: 'H6001', device: '00:01:02...', deviceName: 'Bulb', type: 'light', capabilities: [] }
            ];

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ code: 200, message: 'Success', data: mockDevices })
            });

            const devices = await service.getDevices();

            expect(fetchMock).toHaveBeenCalledWith(
                'https://openapi.api.govee.com/router/api/v1/user/devices',
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        'Govee-API-Key': apiKey
                    })
                })
            );
            expect(devices).toEqual(mockDevices);
        });

        it('should throw on API error', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                statusText: 'Unauthorized'
            });

            await expect(service.getDevices()).rejects.toThrow('API Request failed: Unauthorized');
        });
    });

    describe('setPower', () => {
        it('should send correct payload for power on', async () => {
            const mockDevice: CloudDevice = { sku: 'H6001', device: 'dev1', deviceName: 'Bulb', type: 'light', capabilities: [] };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ code: 200, message: 'Success' })
            });

            await service.setPower(mockDevice, true);

            expect(fetchMock).toHaveBeenCalledWith(
                'https://openapi.api.govee.com/router/api/v1/device/control',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"value":1')
                })
            );
        });
    });

    describe('setColor', () => {
        it('should send correct integer payload for RGB color', async () => {
            const mockDevice: CloudDevice = { sku: 'H6001', device: 'dev1', deviceName: 'Bulb', type: 'light', capabilities: [] };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ code: 200, message: 'Success' })
            });

            // Blue: 0, 0, 255 -> 255
            await service.setColor(mockDevice, 0, 0, 255);

            expect(fetchMock).toHaveBeenCalledWith(
                'https://openapi.api.govee.com/router/api/v1/device/control',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"value":255')
                })
            );

            // White: 255, 255, 255 -> 16777215
            await service.setColor(mockDevice, 255, 255, 255);
            expect(fetchMock).toHaveBeenCalledWith(
                'https://openapi.api.govee.com/router/api/v1/device/control',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"value":16777215')
                })
            );
        });
    });
});
