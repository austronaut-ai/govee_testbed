// Govee BLE command encoder/decoder utilities
import { CommandType } from '../types/device';
import type { DeviceState, RGB } from '../types/device';

// Govee command packet format: 20-byte arrays
// Byte 0: Command type (0x33 for control)
// Byte 1: Sub-command (0x01 power, 0x04 brightness, 0x05 color)
// Bytes 2-18: Command-specific data
// Byte 19: XOR checksum of bytes 0-18

const COMMAND_LENGTH = 20;
const CONTROL_COMMAND = 0x33;
const CHECKSUM_INDEX = 19;

/**
 * Calculate XOR checksum for command bytes
 */
export function calculateChecksum(data: Uint8Array): number {
  let checksum = 0;
  for (let i = 0; i < CHECKSUM_INDEX; i++) {
    checksum ^= data[i];
  }
  return checksum;
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validate and clamp brightness value to 0-255 range
 */
export function validateBrightness(brightness: number): number {
  return clamp(Math.round(brightness), 0, 255);
}

/**
 * Validate and clamp RGB color values to 0-255 range
 */
export function validateRGB(r: number, g: number, b: number): RGB {
  return {
    r: clamp(Math.round(r), 0, 255),
    g: clamp(Math.round(g), 0, 255),
    b: clamp(Math.round(b), 0, 255),
  };
}

/**
 * Encode power command
 */
export function encodePowerCommand(on: boolean): Uint8Array {
  const command = new Uint8Array(COMMAND_LENGTH);
  command[0] = CONTROL_COMMAND;
  command[1] = CommandType.POWER;
  command[2] = on ? 0x01 : 0x00;
  command[CHECKSUM_INDEX] = calculateChecksum(command);
  return command;
}

/**
 * Encode brightness command
 */
export function encodeBrightnessCommand(brightness: number): Uint8Array {
  const validBrightness = validateBrightness(brightness);
  const command = new Uint8Array(COMMAND_LENGTH);
  command[0] = CONTROL_COMMAND;
  command[1] = CommandType.BRIGHTNESS;
  command[2] = validBrightness;
  command[CHECKSUM_INDEX] = calculateChecksum(command);
  return command;
}

/**
 * Encode color command
 */
export function encodeColorCommand(r: number, g: number, b: number): Uint8Array {
  const validColor = validateRGB(r, g, b);
  const command = new Uint8Array(COMMAND_LENGTH);
  command[0] = CONTROL_COMMAND;
  command[1] = CommandType.COLOR;
  command[2] = 0x01; // Manual color mode
  command[3] = validColor.r;
  command[4] = validColor.g;
  command[5] = validColor.b;
  command[CHECKSUM_INDEX] = calculateChecksum(command);
  return command;
}

/**
 * Encode color temperature command
 * Kelvin range: 2000-9000
 */
export function encodeColorTemperatureCommand(kelvin: number): Uint8Array {
  // Clamp kelvin value
  const validKelvin = clamp(Math.round(kelvin), 2000, 9000);

  const command = new Uint8Array(COMMAND_LENGTH);
  command[0] = CONTROL_COMMAND;
  command[1] = CommandType.COLOR;
  command[2] = 0x02; // White Mode

  // Big Endian Kelvin value
  command[3] = (validKelvin >> 8) & 0xFF; // High byte
  command[4] = validKelvin & 0xFF;        // Low byte

  command[CHECKSUM_INDEX] = calculateChecksum(command);
  return command;
}

/**
 * Parse device state from BLE response
 */
export function parseDeviceState(data: DataView): DeviceState | null {
  if (data.byteLength < 20) {
    return null;
  }

  // Govee state response format varies by device
  // This is a basic parser for common state responses
  const state: DeviceState = {
    power: false,
  };

  // Check if this is a state response (command type 0xAA)
  if (data.getUint8(0) === 0xAA) {
    // Power state is typically in byte 2
    state.power = data.getUint8(2) === 0x01;

    // Brightness is typically in byte 3 (if supported)
    if (data.byteLength > 3) {
      state.brightness = data.getUint8(3);
    }

    // Color is typically in bytes 4-6 (if supported)
    if (data.byteLength > 6) {
      state.color = {
        r: data.getUint8(4),
        g: data.getUint8(5),
        b: data.getUint8(6),
      };
    }
  }

  return state;
}
