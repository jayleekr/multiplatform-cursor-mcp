import { createLogger, format, transports } from 'winston'
import path from 'path'
import { PathResolver } from './path-resolver.js'

// Define log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4
}

interface LogEntry {
    timestamp: string
    level: string
    message: string
    context?: string
    [key: string]: any
}

// Create the logger
const logger = createLogger({
    levels: logLevels,
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
    ),
    transports: [
        // Console output
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf((info) => {
                    const contextStr = info.context ? `[${info.context}] ` : ''
                    const { timestamp, level, message, context, ...meta } = info
                    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : ''
                    return `${timestamp} ${level}: ${contextStr}${message}${metaStr}`
                })
            )
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
})

// Add context to log entries
export interface LogContext {
    context?: string
    [key: string]: any
}

class Logger {
    private static instance: Logger
    private constructor() {}

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger()
        }
        return Logger.instance
    }

    error(message: string, context?: LogContext) {
        logger.error(message, context)
    }

    warn(message: string, context?: LogContext) {
        logger.warn(message, context)
    }

    info(message: string, context?: LogContext) {
        logger.info(message, context)
    }

    debug(message: string, context?: LogContext) {
        logger.debug(message, context)
    }

    trace(message: string, context?: LogContext) {
        logger.log('trace', message, context)
    }

    // Create child logger with preset context
    child(defaultContext: string) {
        return {
            error: (message: string, context?: LogContext) => 
                this.error(message, { ...context, context: defaultContext }),
            warn: (message: string, context?: LogContext) => 
                this.warn(message, { ...context, context: defaultContext }),
            info: (message: string, context?: LogContext) => 
                this.info(message, { ...context, context: defaultContext }),
            debug: (message: string, context?: LogContext) => 
                this.debug(message, { ...context, context: defaultContext }),
            trace: (message: string, context?: LogContext) => 
                this.trace(message, { ...context, context: defaultContext })
        }
    }
}

export const log = Logger.getInstance() 