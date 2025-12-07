// Device state and command types for Govee BLE protocol

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface DeviceState {
  power: boolean;
  brightness?: number; // 0-255
  color?: RGB;
  colorTemperature?: number; // Kelvin (2000-9000)
}

export const CommandType = {
  POWER: 0x01,
  BRIGHTNESS: 0x04,
  COLOR: 0x05,
} as const;

export type CommandType = typeof CommandType[keyof typeof CommandType];

export interface GoveeCommand {
  type: CommandType;
  payload: Uint8Array;
}
