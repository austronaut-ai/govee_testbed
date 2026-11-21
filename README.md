# Minecraft Govee Light Controller

Control your Govee smart lights based on in-game Minecraft Bedrock events! Your lights will react to time of day, dimension changes, player damage, and more.

## Features

- 🌙 **Time-based lighting** - Lights change color at night/day
- 🌋 **Dimension colors** - Different colors for Overworld, Nether, and End
- ❤️ **Damage feedback** - Lights flash red when you take damage
- 💀 **Death indicator** - Lights flash on player death
- 💬 **Chat commands** - Control lights directly from Minecraft chat

## Components

1. **Minecraft Behavior Pack** (`minecraft-addon/`) - Monitors game events
2. **Bridge Server** (`server/`) - Receives events and controls Govee lights via API
3. **Web Dashboard** (`src/`) - React app for manual light control (optional)

## Quick Start

### Prerequisites

- Minecraft Bedrock Edition (Windows 10/11)
- Node.js 18+
- A Govee smart light with API access
- Govee API key (get one from the Govee app)

### 1. Configure the Bridge Server

```bash
cd server
npm install

# Copy the example config and add your Govee credentials
cp config.example.json config.json
```

Edit `server/config.json` with your Govee API key and device info:

```json
{
    "govee": {
        "apiKey": "YOUR_GOVEE_API_KEY_HERE",
        "deviceId": "YOUR_DEVICE_ID_HERE",
        "sku": "H6076"
    },
    "server": {
        "httpPort": 3000,
        "wsPort": 19131
    }
}
```

### 2. Install the Minecraft Addon

Run the install script to copy the addon to Minecraft:

```powershell
.\install_addon.ps1
```

Or manually copy `minecraft-addon/` to:
```
%LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs\
```

### 3. Enable the Addon in Your World

1. Open Minecraft Bedrock
2. Edit your world settings
3. Go to **Behavior Packs**
4. Activate **Govee Light Controller**
5. Enable **Beta APIs** in Experiments (required for Script API)

### 4. Disable Encrypted WebSockets

Minecraft requires encrypted WebSockets by default. You need to disable this:

**Option A: In-game setting**
1. Go to Settings → General
2. Find "Require Encrypted Websockets" and turn it OFF

**Option B: Via options file** (may reset when you open settings)
```powershell
$optionsFile = "$env:APPDATA\Minecraft Bedrock\Users\*\games\com.mojang\minecraftpe\options.txt"
(Get-Content $optionsFile) -replace "websocket_encryption:1", "websocket_encryption:0" | Set-Content $optionsFile
```

### 5. Start the Bridge and Connect

```bash
cd server
node bridge.js
```

In Minecraft (after joining your world):
```
/connect localhost:19131
```

You should see "Connection established" in chat and "[Govee] Bridge connected!" when successful.

## Chat Commands

Type these in Minecraft chat to control your lights:

| Command | Effect |
|---------|--------|
| `!red` | Set lights to red |
| `!green` | Set lights to green |
| `!blue` | Set lights to blue |
| `!white` | Set lights to white |
| `!purple` | Set lights to purple |
| `!orange` | Set lights to orange |
| `!on` | Turn lights on |
| `!off` | Turn lights off |

## Automatic Light Behaviors

| Event | Light Response |
|-------|----------------|
| Night time | Blue lighting |
| Day time | White lighting |
| Enter Nether | Red/orange glow |
| Enter End | Purple glow |
| Player hurt | Red flash (1 sec) |
| Player death | Red flash (3 sec) |
| Kill mob | Green flash |

## Troubleshooting

### "Connection closed" in chat
- Make sure "Require Encrypted Websockets" is disabled in Minecraft settings
- Ensure the bridge server is running on port 19131
- Check that no firewall is blocking the connection

### "Encrypted session required" error
- The encryption setting wasn't disabled. Try changing it in-game under Settings → General

### Addon not appearing in behavior packs
- Make sure you copied it to `development_behavior_packs` (not `behavior_packs`)
- Check that the folder structure is correct: `GoveeLightController/manifest.json`

### Lights not responding
- Verify your Govee API key in `config.json`
- Check the bridge console for Govee API errors
- Test the API manually: `curl http://localhost:3000/status`

## API Endpoints

The bridge server exposes these HTTP endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Get connection status and game state |
| `/color` | POST | Set light color `{ r, g, b }` |
| `/command` | POST | Send command to Minecraft `{ command }` |
| `/govee` | POST | Trigger event `{ type, data }` |

### Network exposure

The bridge can run game commands as the player and change your lights, so it is
locked to this machine:

- HTTP and WebSocket servers listen on loopback only (`127.0.0.1` and `::1`).
  Minecraft runs on the same PC and connects to `localhost`, so nothing on the
  LAN needs to reach the bridge.
- Requests must use a loopback `Host` (`localhost`, `127.0.0.1` or `[::1]` with
  the bridge's port), which blocks DNS-rebinding pages.
- Requests and WebSocket handshakes that carry a browser `Origin` header are
  refused with 403. Minecraft's `/connect` client and `curl` send no Origin, so
  they keep working. No CORS headers are sent. If you build a web page that
  should call the bridge, add its origin to `server.allowedOrigins` in
  `config.json` (for example `["http://localhost:5173"]`).
- POST bodies must be `Content-Type: application/json`.

Ports come from `server.httpPort` / `server.wsPort` in `config.json`, or the
`BRIDGE_HTTP_PORT` / `BRIDGE_WS_PORT` environment variables. `npm test` in
`server/` starts the bridge on spare ports and checks these rules.

## Project Structure

```
govee_testbed/
├── minecraft-addon/          # Minecraft Behavior Pack
│   ├── manifest.json         # Pack manifest (v4.0.0)
│   └── scripts/
│       └── main.js           # Game event handling
├── server/                   # Bridge server
│   ├── bridge.js             # Main server (WebSocket + HTTP + Govee API)
│   ├── config.json           # Your configuration (gitignored)
│   ├── config.example.json   # Example configuration
│   └── package.json
├── src/                      # React web dashboard (optional)
├── install_addon.ps1         # Addon installation script
└── README.md
```

## Getting Your Govee API Key

1. Open the Govee Home app
2. Go to Profile → Settings → About Us → Apply for API Key
3. Wait for email with your API key (usually instant)
4. Find your device ID in the app under device settings

## License

MIT
