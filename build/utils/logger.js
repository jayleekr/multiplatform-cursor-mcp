import { createLogger, format, transports } from 'winston';
import path from 'path';
import { PathResolver } from './path-resolver.js';
// Define log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4
};
// Create the logger
const logger = createLogger({
    levels: logLevels,
    format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
    transports: [
        // Console output
        new transports.Console({
            format: format.combine(format.colorize(), format.printf((info) => {
                const contextStr = info.context ? `[${info.context}] ` : '';
                const { timestamp, level, message, context, ...meta } = info;
                const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
                return `${timestamp} ${level}: ${contextStr}${message}${metaStr}`;
            }))
        }),
        // File output
        new transports.File({
            filename: path.join(PathResolver.getConfigPath(), 'error.log'),
            level: 'error'
        }),
        new transports.File({
            filename: path.join(PathResolver.getConfigPath(), 'combined.log')
        })
    ]
});
class Logger {
    static instance;
    constructor() { }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    error(message, context) {
        logger.error(message, context);
    }
    warn(message, context) {
        logger.warn(message, context);
    }
    info(message, context) {
        logger.info(message, context);
    }
    debug(message, context) {
        logger.debug(message, context);
    }
    trace(message, context) {
        logger.log('trace', message, context);
    }
    // Create child logger with preset context
    child(defaultContext) {
        return {
            error: (message, context) => this.error(message, { ...context, context: defaultContext }),
            warn: (message, context) => this.warn(message, { ...context, context: defaultContext }),
            info: (message, context) => this.info(message, { ...context, context: defaultContext }),
            debug: (message, context) => this.debug(message, { ...context, context: defaultContext }),
            trace: (message, context) => this.trace(message, { ...context, context: defaultContext })
        };
    }
}
export const log = Logger.getInstance();
