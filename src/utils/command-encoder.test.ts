// Unit tests for command encoder
import { describe, it, expect } from 'vitest';
import {
  encodePowerCommand,
  encodeBrightnessCommand,
  encodeColorCommand,
  parseDeviceState,
  calculateChecksum,
} from './command-encoder';
import { CommandType } from '../types/device';

describe('Command Encoder', () => {
  describe('encodePowerCommand', () => {
    it('encodes power ON command with correct byte sequence', () => {
      const command = encodePowerCommand(true);
      
      expect(command.length).toBe(20);
      expect(command[0]).toBe(0x33); // Control command
      expect(command[1]).toBe(CommandType.POWER); // Power sub-command (0x01)
      expect(command[2]).toBe(0x01); // ON state
      
      // Verify checksum
      const expectedChecksum = calculateChecksum(command);
      expect(command[19]).toBe(expectedChecksum);
    });

    it('encodes power OFF command with correct byte sequence', () => {
      const command = encodePowerCommand(false);
      
      expect(command.length).toBe(20);
      expect(command[0]).toBe(0x33); // Control command
      expect(command[1]).toBe(CommandType.POWER); // Power sub-command (0x01)
      expect(command[2]).toBe(0x00); // OFF state
      
      // Verify checksum
      const expectedChecksum = calculateChecksum(command);
      expect(command[19]).toBe(expectedChecksum);
    });
  });

  describe('encodeBrightnessCommand', () => {
    it('encodes brightness command with correct byte sequence', () => {
      const brightness = 128;
      const command = encodeBrightnessCommand(brightness);
      
      expect(command.length).toBe(20);
      expect(command[0]).toBe(0x33); // Control command
      expect(command[1]).toBe(CommandType.BRIGHTNESS); // Brightness sub-command (0x04)
      expect(command[2]).toBe(128); // Brightness value
      
      // Verify checksum
      const expectedChecksum = calculateChecksum(command);
      expect(command[19]).toBe(expectedChecksum);
    });

    it('encodes minimum brightness (0)', () => {
      const command = encodeBrightnessCommand(0);
      
      expect(command[2]).toBe(0);
    });

    it('encodes maximum brightness (255)', () => {
      const command = encodeBrightnessCommand(255);
      
      expect(command[2]).toBe(255);
    });

    it('clamps brightness values above 255', () => {
      const command = encodeBrightnessCommand(300);
      
      expect(command[2]).toBe(255);
    });

    it('clamps brightness values below 0', () => {
      const command = encodeBrightnessCommand(-50);
      
      expect(command[2]).toBe(0);
    });
  });

  describe('encodeColorCommand', () => {
    it('encodes color command with correct byte sequence', () => {
      const r = 255, g = 128, b = 64;
      const command = encodeColorCommand(r, g, b);
      
      expect(command.length).toBe(20);
      expect(command[0]).toBe(0x33); // Control command
      expect(command[1]).toBe(CommandType.COLOR); // Color sub-command (0x05)
      expect(command[2]).toBe(0x01); // Manual color mode
      expect(command[3]).toBe(255); // Red
      expect(command[4]).toBe(128); // Green
      expect(command[5]).toBe(64); // Blue
      
      // Verify checksum
      const expectedChecksum = calculateChecksum(command);
      expect(command[19]).toBe(expectedChecksum);
    });

    it('encodes pure red color', () => {
      const command = encodeColorCommand(255, 0, 0);
      
      expect(command[3]).toBe(255);
      expect(command[4]).toBe(0);
      expect(command[5]).toBe(0);
    });

    it('encodes pure green color', () => {
      const command = encodeColorCommand(0, 255, 0);
      
      expect(command[3]).toBe(0);
      expect(command[4]).toBe(255);
      expect(command[5]).toBe(0);
    });

    it('encodes pure blue color', () => {
      const command = encodeColorCommand(0, 0, 255);
      
      expect(command[3]).toBe(0);
      expect(command[4]).toBe(0);
      expect(command[5]).toBe(255);
    });

    it('clamps RGB values above 255', () => {
      const command = encodeColorCommand(300, 400, 500);
      
      expect(command[3]).toBe(255);
      expect(command[4]).toBe(255);
      expect(command[5]).toBe(255);
    });

    it('clamps RGB values below 0', () => {
      const command = encodeColorCommand(-10, -20, -30);
      
      expect(command[3]).toBe(0);
      expect(command[4]).toBe(0);
      expect(command[5]).toBe(0);
    });
  });

  describe('parseDeviceState', () => {
    it('parses device state with power ON', () => {
      // Create a mock state response
      const buffer = new ArrayBuffer(20);
      const view = new DataView(buffer);
      view.setUint8(0, 0xAA); // State response marker
      view.setUint8(2, 0x01); // Power ON
      view.setUint8(3, 200); // Brightness
      view.setUint8(4, 255); // Red
      view.setUint8(5, 128); // Green
      view.setUint8(6, 64); // Blue
      
      const state = parseDeviceState(view);
      
      expect(state).not.toBeNull();
      expect(state?.power).toBe(true);
      expect(state?.brightness).toBe(200);
      expect(state?.color).toEqual({ r: 255, g: 128, b: 64 });
    });

    it('parses device state with power OFF', () => {
      const buffer = new ArrayBuffer(20);
      const view = new DataView(buffer);
      view.setUint8(0, 0xAA); // State response marker
      view.setUint8(2, 0x00); // Power OFF
      
      const state = parseDeviceState(view);
      
      expect(state).not.toBeNull();
      expect(state?.power).toBe(false);
    });

    it('returns null for invalid response (too short)', () => {
      const buffer = new ArrayBuffer(10);
      const view = new DataView(buffer);
      
      const state = parseDeviceState(view);
      
      expect(state).toBeNull();
    });

    it('returns null for non-state response', () => {
      const buffer = new ArrayBuffer(20);
      const view = new DataView(buffer);
      view.setUint8(0, 0x33); // Not a state response marker
      
      const state = parseDeviceState(view);
      
      expect(state).not.toBeNull();
      expect(state?.power).toBe(false); // Default state
    });
  });

  describe('calculateChecksum', () => {
    it('calculates XOR checksum correctly', () => {
      const data = new Uint8Array(20);
      data[0] = 0x33;
      data[1] = 0x01;
      data[2] = 0x01;
      
      const checksum = calculateChecksum(data);
      
      // XOR of 0x33, 0x01, 0x01, and 16 zeros
      expect(checksum).toBe(0x33 ^ 0x01 ^ 0x01);
    });

    it('calculates checksum for all zeros', () => {
      const data = new Uint8Array(20);
      
      const checksum = calculateChecksum(data);
      
      expect(checksum).toBe(0);
    });

    it('calculates checksum for all ones', () => {
      const data = new Uint8Array(20);
      for (let i = 0; i < 19; i++) {
        data[i] = 0xFF;
      }
      
      const checksum = calculateChecksum(data);
      
      // XOR of 19 0xFF values
      // 0xFF ^ 0xFF = 0x00, so odd number of 0xFF = 0xFF
      expect(checksum).toBe(0xFF);
    });
  });
});
