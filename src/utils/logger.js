"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
};
function timestamp() {
    return new Date().toISOString();
}
function format(level, color, message, ...args) {
    const extra = args.length ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : '';
    return `${colors.gray}[${timestamp()}]${colors.reset} ${color}[${level}]${colors.reset} ${message}${extra}`;
}
exports.logger = {
    info(message, ...args) {
        console.log(format('INFO', colors.cyan, message, ...args));
    },
    success(message, ...args) {
        console.log(format('OK', colors.green, message, ...args));
    },
    warn(message, ...args) {
        console.warn(format('WARN', colors.yellow, message, ...args));
    },
    error(message, ...args) {
        console.error(format('ERROR', colors.red, message, ...args));
    },
    debug(message, ...args) {
        if (process.env.DEBUG === 'true') {
            console.log(format('DEBUG', colors.magenta, message, ...args));
        }
    },
    game(message, ...args) {
        console.log(format('GAME', colors.yellow, message, ...args));
    },
};
//# sourceMappingURL=logger.js.map