import { world, system } from "@minecraft/server";

// Govee Light Controller V4 - WebSocket approach via script events
// Since @minecraft/server-net only works on BDS, we use script events
// to communicate with an external bridge that monitors the content log

const VERSION = "4.0.0";

// State tracking
let lastTimeState = "day";
let lastDimension = "minecraft:overworld";
let lastHealth = 20;

// Helper to send state updates via console (bridge monitors this)
function sendState(eventType, data) {
    // Format: [GOVEE_EVENT] type|json_data
    const payload = JSON.stringify({ type: eventType, ...data, timestamp: Date.now() });
    console.warn(`[GOVEE_EVENT] ${payload}`);
}

// Startup message
system.run(() => {
    world.sendMessage(`§a[Govee V${VERSION}] Script loaded!`);
    world.sendMessage("§e[Govee] Monitoring: time, dimension, health");
    console.warn(`[Govee V${VERSION}] Script Started`);
    sendState("startup", { version: VERSION });
});

// Player Join Event
world.afterEvents.playerSpawn.subscribe((ev) => {
    const player = ev.player;
    if (ev.initialSpawn) {
        player.sendMessage(`§a[Govee V${VERSION}] Welcome! Light control is active.`);
        sendState("playerJoin", { player: player.name });
    }
});

// Time of Day monitoring - affects light color/brightness
system.runInterval(() => {
    const time = world.getTimeOfDay();
    // Day: 0-12000, Night: 13000-23000
    const isNight = time > 13000 && time < 23000;
    const currentState = isNight ? "night" : "day";
    
    if (currentState !== lastTimeState) {
        lastTimeState = currentState;
        world.sendMessage(`§b[Govee] Time changed to ${currentState}`);
        sendState("timeChange", { isNight, time, state: currentState });
    }
}, 100); // Check every 5 seconds

// Dimension change - affects light color
world.afterEvents.playerDimensionChange.subscribe((event) => {
    const dimension = event.toDimension.id;
    if (dimension !== lastDimension) {
        lastDimension = dimension;
        world.sendMessage(`§d[Govee] Dimension: ${dimension}`);
        sendState("dimensionChange", { dimension });
    }
});

// Player hurt - flash lights red
world.afterEvents.entityHurt.subscribe((event) => {
    if (event.hurtEntity.typeId === "minecraft:player") {
        const player = event.hurtEntity;
        world.sendMessage(`§c[Govee] Player hurt! (${event.damage} damage)`);
        sendState("playerHurt", { 
            damage: event.damage, 
            player: player.name,
            health: player.getComponent("health")?.currentValue ?? 0
        });
    }
});

// Player death
world.afterEvents.entityDie.subscribe((event) => {
    if (event.deadEntity.typeId === "minecraft:player") {
        world.sendMessage("§4[Govee] Player died!");
        sendState("playerDeath", { player: event.deadEntity.name });
    }
});

// Script event command handler - for manual testing
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "govee:test") {
        world.sendMessage("§a[Govee] Test event triggered!");
        sendState("test", { message: "Manual test from game" });
    } else if (event.id === "govee:status") {
        world.sendMessage(`§e[Govee] Status: time=${lastTimeState}, dim=${lastDimension}`);
    }
});
