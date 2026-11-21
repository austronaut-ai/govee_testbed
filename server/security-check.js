// Run with: npm test (in server/)
// Starts bridge.js on spare ports and checks that web pages cannot drive it:
// any page could otherwise run game commands, change the lights, or take over
// the Minecraft WebSocket slot and fake chat events.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const WebSocket = require('ws');

let child;
let httpPort;
let wsPort;

function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.once('error', reject);
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
    });
}

function hasIPv6Loopback() {
    return new Promise((resolve) => {
        const srv = net.createServer();
        srv.once('error', () => resolve(false));
        srv.listen(0, '::1', () => srv.close(() => resolve(true)));
    });
}

function request(method, urlPath, headers = {}, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(
            { host: '127.0.0.1', port: httpPort, method, path: urlPath, headers: { Host: `localhost:${httpPort}`, ...headers } },
            (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
            }
        );
        req.on('error', reject);
        if (body !== undefined) req.write(body);
        req.end();
    });
}

function wsConnect(host, headers = {}) {
    return new Promise((resolve) => {
        const ws = new WebSocket(`ws://${host}:${wsPort}`, { headers });
        ws.on('open', () => { ws.close(); resolve('open'); });
        ws.on('unexpected-response', (_req, res) => resolve(res.statusCode));
        ws.on('error', (err) => resolve(err.code || 'error'));
    });
}

before(async () => {
    httpPort = await freePort();
    wsPort = await freePort();
    child = spawn(process.execPath, [path.join(__dirname, 'bridge.js')], {
        // Empty Govee credentials so no request ever leaves the machine.
        env: { ...process.env, BRIDGE_HTTP_PORT: String(httpPort), BRIDGE_WS_PORT: String(wsPort), GOVEE_API_KEY: '', GOVEE_DEVICE_ID: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
        let out = '';
        const timer = setTimeout(() => reject(new Error(`bridge did not start:\n${out}`)), 10000);
        const onData = (d) => {
            out += d;
            if (out.includes('MINECRAFT GOVEE BRIDGE') && out.includes('WebSocket listening')) {
                clearTimeout(timer);
                resolve();
            }
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        child.on('exit', (code) => reject(new Error(`bridge exited (${code}):\n${out}`)));
    });
});

after(() => child && child.kill());

test('foreign Origin is refused on every endpoint', async () => {
    const evil = { Origin: 'https://evil.example', 'Content-Type': 'application/json' };
    assert.strictEqual((await request('GET', '/status', evil)).status, 403);
    assert.strictEqual((await request('POST', '/command', evil, '{"command":"say hi"}')).status, 403);
    assert.strictEqual((await request('POST', '/color', evil, '{"r":1,"g":2,"b":3}')).status, 403);
    assert.strictEqual((await request('POST', '/govee', evil, '{"type":"govee:night"}')).status, 403);
});

test('no CORS headers are sent', async () => {
    const res = await request('GET', '/status');
    assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
});

test('foreign Host (DNS rebinding) is refused', async () => {
    assert.strictEqual((await request('GET', '/status', { Host: `evil.example:${httpPort}` })).status, 403);
});

test('text/plain POST (no-preflight cross-site form) is refused', async () => {
    const res = await request('POST', '/command', { 'Content-Type': 'text/plain' }, '{"command":"say hi"}');
    assert.strictEqual(res.status, 415);
});

test('local requests without Origin still work', async () => {
    const status = await request('GET', '/status');
    assert.strictEqual(status.status, 200);
    assert.strictEqual(JSON.parse(status.body).connected, false);
    const color = await request('POST', '/color', { 'Content-Type': 'application/json' }, '{"r":1,"g":2,"b":3}');
    assert.strictEqual(color.status, 200);
});

test('WebSocket handshake with a browser Origin is refused', async () => {
    assert.strictEqual(await wsConnect('127.0.0.1', { Origin: 'https://evil.example' }), 403);
});

test('WebSocket without Origin (as Minecraft /connect sends) is accepted on IPv4 and IPv6 loopback', async () => {
    assert.strictEqual(await wsConnect('127.0.0.1'), 'open');
    if (await hasIPv6Loopback()) assert.strictEqual(await wsConnect('[::1]'), 'open');
});
