/**
 * Property-based tests for command encoder
 * Feature: govee-bluetooth-dashboard
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateChecksum,
  encodePowerCommand,
  encodeBrightnessCommand,
  encodeColorCommand,
  validateBrightness,
  validateRGB,
} from './command-encoder';

/**
 * **Feature: govee-bluetooth-dashboard, Property 3: Command checksum validity**
 * **Validates: Requirements 4.1, 5.1, 6.2**
 * 
 * For any generated Govee command packet, the checksum byte (byte 19) 
 * should equal the XOR of bytes 0-18.
 */
describe('Property 3: Command checksum validity', () => {
  it('power commands have valid checksums', () => {
    fc.assert(
      fc.property(fc.boolean(), (powerOn) => {
        const command = encodePowerCommand(powerOn);
        
        // Verify command length
        expect(command.length).toBe(20);
        
        // Calculate expected checksum
        let expectedChecksum = 0;
        for (let i = 0; i < 19; i++) {
          expectedChecksum ^= command[i];
        }
        
        // Verify checksum matches
        expect(command[19]).toBe(expectedChecksum);
        expect(command[19]).toBe(calculateChecksum(command));
      }),
      { numRuns: 100 }
    );
  });

  it('brightness commands have valid checksums', () => {
    fc.assert(
      fc.property(fc.integer(), (brightness) => {
        const command = encodeBrightnessCommand(brightness);
        
        // Verify command length
        expect(command.length).toBe(20);
        
        // Calculate expected checksum
        let expectedChecksum = 0;
        for (let i = 0; i < 19; i++) {
          expectedChecksum ^= command[i];
        }
        
        // Verify checksum matches
        expect(command[19]).toBe(expectedChecksum);
        expect(command[19]).toBe(calculateChecksum(command));
      }),
      { numRuns: 100 }
    );
  });

  it('color commands have valid checksums', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        fc.integer(),
        (r, g, b) => {
          const command = encodeColorCommand(r, g, b);
          
          // Verify command length
          expect(command.length).toBe(20);
          
          // Calculate expected checksum
          let expectedChecksum = 0;
          for (let i = 0; i < 19; i++) {
            expectedChecksum ^= command[i];
          }
          
          // Verify checksum matches
          expect(command[19]).toBe(expectedChecksum);
          expect(command[19]).toBe(calculateChecksum(command));
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: govee-bluetooth-dashboard, Property 4: Input value bounds validation**
 * **Validates: Requirements 5.3, 6.3**
 * 
 * For any brightness or color command, all numeric values (brightness 0-255, 
 * RGB components 0-255) should be validated and clamped to their valid ranges 
 * before encoding.
 */
describe('Property 4: Input value bounds validation', () => {
  it('brightness values are clamped to 0-255 range', () => {
    fc.assert(
      fc.property(fc.integer(), (brightness) => {
        const command = encodeBrightnessCommand(brightness);
        
        // Extract brightness value from command
        const encodedBrightness = command[2];
        
        // Verify brightness is within valid range
        expect(encodedBrightness).toBeGreaterThanOrEqual(0);
        expect(encodedBrightness).toBeLessThanOrEqual(255);
        
        // Verify clamping behavior
        if (brightness < 0) {
          expect(encodedBrightness).toBe(0);
        } else if (brightness > 255) {
          expect(encodedBrightness).toBe(255);
        } else {
          expect(encodedBrightness).toBe(Math.round(brightness));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('RGB color values are clamped to 0-255 range', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        fc.integer(),
        (r, g, b) => {
          const command = encodeColorCommand(r, g, b);
          
          // Extract RGB values from command
          const encodedR = command[3];
          const encodedG = command[4];
          const encodedB = command[5];
          
          // Verify all RGB values are within valid range
          expect(encodedR).toBeGreaterThanOrEqual(0);
          expect(encodedR).toBeLessThanOrEqual(255);
          expect(encodedG).toBeGreaterThanOrEqual(0);
          expect(encodedG).toBeLessThanOrEqual(255);
          expect(encodedB).toBeGreaterThanOrEqual(0);
          expect(encodedB).toBeLessThanOrEqual(255);
          
          // Verify clamping behavior for red
          if (r < 0) {
            expect(encodedR).toBe(0);
          } else if (r > 255) {
            expect(encodedR).toBe(255);
          } else {
            expect(encodedR).toBe(Math.round(r));
          }
          
          // Verify clamping behavior for green
          if (g < 0) {
            expect(encodedG).toBe(0);
          } else if (g > 255) {
            expect(encodedG).toBe(255);
          } else {
            expect(encodedG).toBe(Math.round(g));
          }
          
          // Verify clamping behavior for blue
          if (b < 0) {
            expect(encodedB).toBe(0);
          } else if (b > 255) {
            expect(encodedB).toBe(255);
          } else {
            expect(encodedB).toBe(Math.round(b));
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validateBrightness function clamps values correctly', () => {
    fc.assert(
      fc.property(fc.integer(), (brightness) => {
        const validated = validateBrightness(brightness);
        
        // Verify result is within valid range
        expect(validated).toBeGreaterThanOrEqual(0);
        expect(validated).toBeLessThanOrEqual(255);
        
        // Verify clamping behavior
        if (brightness < 0) {
          expect(validated).toBe(0);
        } else if (brightness > 255) {
          expect(validated).toBe(255);
        } else {
          expect(validated).toBe(Math.round(brightness));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('validateRGB function clamps values correctly', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        fc.integer(),
        (r, g, b) => {
          const validated = validateRGB(r, g, b);
          
          // Verify all values are within valid range
          expect(validated.r).toBeGreaterThanOrEqual(0);
          expect(validated.r).toBeLessThanOrEqual(255);
          expect(validated.g).toBeGreaterThanOrEqual(0);
          expect(validated.g).toBeLessThanOrEqual(255);
          expect(validated.b).toBeGreaterThanOrEqual(0);
          expect(validated.b).toBeLessThanOrEqual(255);
          
          // Verify clamping behavior
          if (r < 0) {
            expect(validated.r).toBe(0);
          } else if (r > 255) {
            expect(validated.r).toBe(255);
          } else {
            expect(validated.r).toBe(Math.round(r));
          }
          
          if (g < 0) {
            expect(validated.g).toBe(0);
          } else if (g > 255) {
            expect(validated.g).toBe(255);
          } else {
            expect(validated.g).toBe(Math.round(g));
          }
          
          if (b < 0) {
            expect(validated.b).toBe(0);
          } else if (b > 255) {
            expect(validated.b).toBe(255);
          } else {
            expect(validated.b).toBe(Math.round(b));
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
