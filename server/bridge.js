const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const WebSocket = require('ws');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

const app = express();

// Generate or load SSL certificates
function getSSLCerts() {
    const certDir = path.join(__dirname, 'certs');
    const keyPath = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');
    
    // Create certs directory if it doesn't exist
    if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir);
    }
    
    // Check if we already have certs
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        console.log('Loading existing SSL certificates...');
        return {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
    }
    
    // Generate new self-signed certs using node-forge
    console.log('Generating new SSL certificates...');
    
    // Generate key pair
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    // Create certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    const attrs = [
        { name: 'commonName', value: 'localhost' },
        { name: 'organizationName', value: 'Govee Bridge' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    
    // Add extensions
    cert.setExtensions([
        { name: 'basicConstraints', cA: false },
        { name: 'keyUsage', keyCertSign: false, digitalSignature: true, keyEncipherment: true },
        { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] }
    ]);
    
    // Self-sign
    cert.sign(keys.privateKey, forge.md.sha256.create());
    
    // Convert to PEM
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const certPem = forge.pki.certificateToPem(cert);
    
    // Save for reuse
    fs.writeFileSync(keyPath, privateKeyPem);
    fs.writeFileSync(certPath, certPem);
    
    console.log('SSL certificates generated and saved.');
    
    return {
        key: privateKeyPem,
        cert: certPem
    };
}

// Generate UUID for requests
function uuid() {
    return crypto.randomUUID();
}

// Load configuration
let config = {};
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('Loaded config from config.json');
} else {
    console.warn('Warning: config.json not found. Copy config.example.json to config.json and add your API key.');
}

// API Key from config or environment
const GOVEE_API_KEY = process.env.GOVEE_API_KEY || config.govee?.apiKey || '';
const DEVICE_ID = process.env.GOVEE_DEVICE_ID || config.govee?.deviceId || '';
const SKU = process.env.GOVEE_SKU || config.govee?.sku || 'H6076';

const PORT = Number(process.env.BRIDGE_HTTP_PORT) || config.server?.httpPort || 3000;
const WS_PORT = Number(process.env.BRIDGE_WS_PORT) || config.server?.wsPort || 19131;

// ============= REQUEST SOURCE CHECKS =============
// The bridge can run game commands as the player and change the lights, so it
// only listens on loopback and refuses anything a web page could send:
// - Host must be a loopback name (blocks DNS rebinding).
// - Origin, if present, must be allowlisted. Browsers always send Origin on
//   cross-site requests and WebSocket handshakes; Minecraft's /connect client
//   and curl do not. No front-end in this repo calls the bridge, so the
//   allowlist is empty unless config.server.allowedOrigins adds entries.
const LOOPBACK_ADDRESSES = ['127.0.0.1', '::1'];
const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];
const ALLOWED_ORIGINS = new Set(
    (config.server?.allowedOrigins || []).map((o) => String(o).toLowerCase())
);

function isLoopbackHost(hostHeader, port) {
    const host = String(hostHeader || '').toLowerCase();
    return LOOPBACK_HOSTNAMES.some((h) => host === `${h}:${port}`);
}

function isAllowedOrigin(origin) {
    return origin === undefined || ALLOWED_ORIGINS.has(String(origin).toLowerCase());
}

app.use((req, res, next) => {
    if (!isLoopbackHost(req.headers.host, PORT)) {
        console.warn(`Refused HTTP request with Host: ${req.headers.host}`);
        return res.status(403).json({ error: 'Forbidden host' });
    }
    if (!isAllowedOrigin(req.headers.origin)) {
        console.warn(`Refused HTTP request from Origin: ${req.headers.origin}`);
        return res.status(403).json({ error: 'Forbidden origin' });
    }
    if (req.method === 'POST' && !req.is('application/json')) {
        return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
    next();
});
app.use(bodyParser.json());

// Track game state
let gameState = {
    isNight: false,
    dimension: 'minecraft:overworld',
    lastUpdate: null
};

// ============= GOVEE CONTROL =============
async function controlDevice(capability) {
    if (!GOVEE_API_KEY || !DEVICE_ID || !SKU) return;

    const payload = {
        requestId: 'uuid',
        payload: {
            sku: SKU,
            device: DEVICE_ID,
            capability
        }
    };

    try {
        const response = await fetch('https://openapi.api.govee.com/router/api/v1/device/control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Govee-API-Key': GOVEE_API_KEY
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log("Govee Response:", data);
    } catch (err) {
        console.error("Govee Error:", err);
    }
}

async function setColor(r, g, b) {
    const value = (r << 16) | (g << 8) | b;
    await controlDevice({ type: 'devices.capabilities.color_setting', instance: 'colorRgb', value });
}

// ============= EVENT HANDLERS =============
async function handleGameEvent(type, data) {
    console.log(`[Game Event] ${type}:`, JSON.stringify(data));
    gameState.lastUpdate = new Date().toISOString();

    try {
        switch (type) {
            case 'PlayerMessage':
                // Check for custom commands in chat
                if (data.message && data.message.startsWith('!')) {
                    handleChatCommand(data.message, data.sender);
                }
                break;
                
            case 'PlayerTravelled':
                // Player moved - could track distance
                break;
                
            case 'PlayerDied':
                console.log('Player died! Flashing red...');
                await setColor(255, 0, 0);
                setTimeout(() => setColor(255, 255, 255), 3000);
                break;
                
            case 'PlayerTransform':
                // Player position update - check dimension from world
                break;

            case 'BlockBroken':
            case 'BlockPlaced':
                // Could react to certain blocks
                break;

            case 'ItemUsed':
                // React to item usage
                break;

            case 'MobKilled':
                // Flash green when killing mobs
                console.log('Mob killed!');
                await setColor(0, 255, 0);
                setTimeout(() => setColor(255, 255, 255), 500);
                break;

            // Custom events from our addon (via chat or title)
            case 'govee:night':
                console.log('Night time - setting blue...');
                gameState.isNight = true;
                await setColor(0, 0, 255);
                break;

            case 'govee:day':
                console.log('Day time - setting white...');
                gameState.isNight = false;
                await setColor(255, 255, 255);
                break;

            case 'govee:nether':
                console.log('Entered Nether - setting red...');
                gameState.dimension = 'minecraft:the_nether';
                await setColor(255, 50, 0);
                break;

            case 'govee:end':
                console.log('Entered End - setting purple...');
                gameState.dimension = 'minecraft:the_end';
                await setColor(128, 0, 128);
                break;

            case 'govee:overworld':
                console.log('Entered Overworld - setting white...');
                gameState.dimension = 'minecraft:overworld';
                await setColor(255, 255, 255);
                break;

            case 'govee:hurt':
                console.log('Player hurt! Flashing red...');
                await setColor(255, 0, 0);
                setTimeout(() => setColor(255, 255, 255), 1000);
                break;
        }
    } catch (error) {
        console.error("Event handler error:", error);
    }
}

async function handleChatCommand(message, sender) {
    const cmd = message.toLowerCase().trim();
    console.log(`Chat command from ${sender}: ${cmd}`);
    
    if (cmd === '!red') await setColor(255, 0, 0);
    else if (cmd === '!green') await setColor(0, 255, 0);
    else if (cmd === '!blue') await setColor(0, 0, 255);
    else if (cmd === '!white') await setColor(255, 255, 255);
    else if (cmd === '!purple') await setColor(128, 0, 128);
    else if (cmd === '!orange') await setColor(255, 165, 0);
    else if (cmd === '!off') await controlDevice({ type: 'devices.capabilities.on_off', instance: 'powerSwitch', value: 0 });
    else if (cmd === '!on') await controlDevice({ type: 'devices.capabilities.on_off', instance: 'powerSwitch', value: 1 });
}

// ============= WEBSOCKET SERVER =============
// Using plain WebSocket - Minecraft encryption setting must be disabled in-game
const wss = new WebSocket.Server({
    noServer: true,
    // Minecraft's /connect client sends no Origin; a browser page always does.
    verifyClient: ({ origin }, done) => {
        if (isAllowedOrigin(origin)) return done(true);
        console.warn(`Refused WebSocket connection from Origin: ${origin}`);
        done(false, 403, 'Forbidden origin');
    }
});
let minecraftClient = null;

wss.on('connection', (ws) => {
    console.log('Minecraft connected!');
    minecraftClient = ws;

    // Don't send anything immediately - wait for Minecraft to be ready
    // Subscribe to events after a short delay
    setTimeout(() => {
        subscribeToEvents(ws);
    }, 500);

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('Received:', message.header?.messagePurpose, message.header?.eventName || '');
            
            if (message.header?.messagePurpose === 'event') {
                handleGameEvent(message.header.eventName, message.body);
            } else if (message.header?.messagePurpose === 'commandResponse') {
                console.log('Command response:', message.body?.statusMessage || 'OK');
            } else if (message.header?.messagePurpose === 'error') {
                console.error('Minecraft error:', message.body);
            }
        } catch (err) {
            console.error('Failed to parse message:', err.message);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`Minecraft disconnected (code: ${code}, reason: ${reason})`);
        minecraftClient = null;
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
    });
});

function subscribeToEvents(ws) {
    // Subscribe to events we care about
    const subscribeEvents = [
        'PlayerMessage',
        'PlayerDied',
        'MobKilled',
        'EntityHurt',
        'PlayerTravelled'
    ];

    console.log('Subscribing to events...');
    
    subscribeEvents.forEach((eventName, index) => {
        // Stagger subscriptions slightly
        setTimeout(() => {
            const msg = {
                header: {
                    version: 1,
                    requestId: uuid(),
                    messageType: 'commandRequest',
                    messagePurpose: 'subscribe'
                },
                body: {
                    eventName: eventName
                }
            };
            
            try {
                ws.send(JSON.stringify(msg));
                console.log(`Subscribed to: ${eventName}`);
            } catch (err) {
                console.error(`Failed to subscribe to ${eventName}:`, err.message);
            }
        }, index * 100);
    });

    // Send a test command after subscriptions
    setTimeout(() => {
        sendMinecraftCommand('tellraw @a {"rawtext":[{"text":"§a[Govee] Bridge connected!"}]}');
    }, subscribeEvents.length * 100 + 500);
}

function sendMinecraftCommand(command) {
    if (!minecraftClient) return;
    
    minecraftClient.send(JSON.stringify({
        header: {
            version: 1,
            requestId: uuid(),
            messageType: 'commandRequest',
            messagePurpose: 'commandRequest'
        },
        body: {
            version: 1,
            commandLine: command,
            origin: { type: 'player' }
        }
    }));
}

// ============= HTTP API =============
app.post('/govee', async (req, res) => {
    const { type, data } = req.body;
    await handleGameEvent(type, data);
    res.json({ status: 'ok' });
});

app.get('/status', (req, res) => {
    res.json({
        connected: minecraftClient !== null,
        gameState,
        device: { id: DEVICE_ID, sku: SKU }
    });
});

app.post('/command', (req, res) => {
    const { command } = req.body;
    if (typeof command !== 'string' || command.length === 0) {
        return res.status(400).json({ error: 'command must be a non-empty string' });
    }
    if (minecraftClient) {
        sendMinecraftCommand(command);
        res.json({ status: 'sent' });
    } else {
        res.status(400).json({ error: 'Minecraft not connected' });
    }
});

app.post('/color', async (req, res) => {
    const { r, g, b } = req.body;
    const isByte = (v) => Number.isInteger(v) && v >= 0 && v <= 255;
    if (![r, g, b].every(isByte)) {
        return res.status(400).json({ error: 'r, g and b must be integers 0-255' });
    }
    await setColor(r, g, b);
    res.json({ status: 'ok' });
});

// ============= START SERVER =============
// Listen on both IPv4 and IPv6 loopback so `localhost` works whichever one it
// resolves to, without exposing the bridge to the local network.
function listenLoopback(port, makeServer, onReady) {
    let pending = LOOPBACK_ADDRESSES.length;
    let listening = 0;
    for (const address of LOOPBACK_ADDRESSES) {
        const server = makeServer();
        server.on('error', (err) => {
            // ::1 may be unavailable (IPv6 disabled); 127.0.0.1 is enough then.
            if (address === '::1' && (err.code === 'EADDRNOTAVAIL' || err.code === 'EAFNOSUPPORT')) {
                if (--pending === 0 && listening > 0) onReady();
                return;
            }
            console.error(`Failed to listen on ${address}:${port}:`, err.message);
            process.exit(1);
        });
        server.listen(port, address, () => {
            listening++;
            if (--pending === 0) onReady();
        });
    }
}

listenLoopback(WS_PORT, () => {
    const server = http.createServer((req, res) => {
        res.writeHead(426, { 'Content-Type': 'text/plain' });
        res.end('WebSocket only');
    });
    server.on('upgrade', (req, socket, head) => {
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    });
    return server;
}, () => console.log(`WebSocket listening on loopback port ${WS_PORT}`));

listenLoopback(PORT, () => http.createServer(app), () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('  MINECRAFT GOVEE BRIDGE');
    console.log('='.repeat(60));
    console.log(`  HTTP API: http://localhost:${PORT}`);
    console.log(`  WebSocket: ws://localhost:${WS_PORT}`);
    console.log(`  Device: ${DEVICE_ID} (${SKU})`);
    console.log('');
    console.log('  TO CONNECT FROM MINECRAFT:');
    console.log(`  /connect localhost:${WS_PORT}`);
    console.log('');
    console.log('  NOTE: Disable "Require Encrypted Websockets" in');
    console.log('  Minecraft Settings > General to use this connection.');
    console.log('');
    console.log('  CHAT COMMANDS (in Minecraft):');
    console.log('  !red !green !blue !white !purple !orange !on !off');
    console.log('='.repeat(60));
    console.log('');
});
