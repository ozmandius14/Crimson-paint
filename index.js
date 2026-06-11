const color = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    underscore: "\x1b[4m",
    blink: "\x1b[5m",
    reverse: "\x1b[7m",
    hidden: "\x1b[8m",

    fg: {
        black: "\x1b[30m",
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
        white: "\x1b[37m"
    },
    bg: {
        black: "\x1b[40m",
        red: "\x1b[41m",
        green: "\x1b[42m",
        yellow: "\x1b[43m",
        blue: "\x1b[44m",
        magenta: "\x1b[45m",
        cyan: "\x1b[46m",
        white: "\x1b[47m"
    }
};
const { types } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');
const { dir } = require('node:console');
const wss = new WebSocket.Server({ port: 50000 });
const version = 1.0; // Version number for the server, used for compatibility checks with clients and mods.
console.log(`Crimson Paint Server v${version.toPrecision(2)} starting...`);
const clients = new Map(); // Map to store client connections with their unique IDs as keys
const clientsByName = new Map(); // Map to store client IDs by their names for easier reference
const args = process.argv.slice(2); // Get arguments passed to the script
const servermotd = "Welcome to the server!"; // MOTD (Message of the Day) for clients when they connect
const vm = require('node:vm');
let attributes = {
  "movementspeed": 2, // in units per tick
  "pistolspeed": 0.25, // in seconds between shots
  "pistoldamage": 2, // in units of damage
  "riflespeed": 1, // in seconds between shots
  "rifledamage": 4 // in units of damage
}; // I cannot make mods work so I will tell people to edit these attributes directly in the code for now, but I will eventually add support for mods to edit these attributes without having to edit the code.
const anticheatEnabled = !args.includes('-d'); // Check if -d (disable anticheat) flag is present
if (args.includes('--help') || args.includes('-h')) {
    console.info(color.bright +color.fg.cyan + 'Usage: ' + color.fg.yellow + 'node index.js [options]');
    console.info(color.fg.cyan + '• -d: ' + color.fg.yellow + 'Disable anticheat');
    console.info(color.fg.cyan + '• --help, -h: ' + color.fg.yellow + 'Show this help message');
    console.info(color.fg.cyan + '• sensitivity=<number>: ' + color.fg.yellow + 'Set anticheat movement sensitivity (default is 20)');
    console.info(color.fg.cyan +'• You can also pass a .mod file for modding purposes. (check out the README for more info on modding)' + color.reset);
    process.exit(0);
}
if (!anticheatEnabled) {
    console.warn('Warning: Anticheat is disabled.');
}
function send(id,message) {
    const client = clients.get(id);

    client.send(message, (err) => {
      if (err) {
        console.error(`Error sending message to client ${id}:`, err);
      }
    });
}
function broadcast(message) {
    clients.forEach((client) => {
      client.send(message, (err) => {
        if (err) {
          console.error(`Error broadcasting message:`, err);
        }
      });
    });
}
wss.on('connection', function connection(ws) {
  // Generate a unique ID for the new client
    const clientId = Math.floor(Math.random() * 20000).toString();
    clients.set(clientId, ws);
    ws.send(JSON.stringify({action: 'connect', Modt: servermodt, id: clientId, attributes: attributes})); // Send welcome message with client ID and attributes
    let previousxy = 0;
    let direction = 0;
    console.log(`Client ${clientId} connected.`);
    ws.on('message', function message(data, isBinary) {
        const message = isBinary ? data : data.toString();
        // Attempt to parse the message as JSON.
        console.log(`Received message from client ${clientId}:`, message);
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message);
            direction = parsedMessage.dir;
            if (!clientsByName.has(clientId) && parsedMessage.name) {
                clientsByName.set(clientId, parsedMessage.name);
                console.log(`Client ${clientId} set name to ${parsedMessage.name}.`);
            }
            // Handle anticheat violations.
            if (Math.abs(previousxy - (parsedMessage.x + parsedMessage.y)) > attributes.movementspeed ** 2 * 2 && anticheatEnabled) { // Check if the movement exceeds the allowed speed (squared for because you can move both horizontally and vertically at the same time).
                console.warn(`${color.bright}${color.fg.yellow}Anticheat detected client ${clientsByName.get(clientId)? clientsByName.get(clientId):clientId} moving too fast.${color.reset}`); // Log the violation for monitoring.
                ws.close(1008, `Anticheat violation detected`); // Code 1008 indicates a policy violation.
            }
            previousxy = parsedMessage.x + parsedMessage.y;
        } catch (error) {
            console.error(`Error parsing message from client ${clientId}:`, error);
            ws.close(1003, `Invalid message format or ddsos attempt detected`); // Code 1003 indicates an unsupported data type, which is appropriate for invalid message formats or potential DDoS attempts.
            return;
        }
        
    });
    ws.on('close', function close() {
        clients.delete(clientId);
        clientsByName.delete(clientId);
        console.log(`Client ${clientId} disconnected.`);
    });
});
