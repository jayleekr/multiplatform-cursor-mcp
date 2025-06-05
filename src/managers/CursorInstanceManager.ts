import { CursorInstance } from '../types/cursor.js'
import path from 'path'
import { spawn } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import { WindowManager, WindowInfo } from '../services/window-manager/types.js'
import { WindowManagerFactory } from '../services/window-manager/factory.js'
import { PathResolver } from '../utils/path-resolver.js'
import { log } from '../utils/logger.js'

export interface CursorInstanceManager {
    create(workspacePath?: string): Promise<CursorInstance>
    get(id: string): CursorInstance | undefined
    sendKeyToInstance(id: string, keys: string[]): Promise<void>
    openCommandPalette(id: string): Promise<void>
    openClineTab(id: string): Promise<void>
    list(): CursorInstance[]
    remove(id: string): boolean
}

/**
 * Security-hardened Cursor Instance Manager
 * Implements secure process spawning and input validation
 */
export class CursorInstanceManagerImpl implements CursorInstanceManager {
    private windowManager: Promise<WindowManager>
    private instances: Map<string, CursorInstance & { window?: WindowInfo }>
    private readonly securityLogger = log.child('CursorInstanceManager-Security')
    private readonly MAX_INSTANCES = 10
    private readonly SAFE_ENV_KEYS = new Set([
        'PATH', 'HOME', 'USER', 'LANG', 'SHELL', 'DISPLAY',
        'ELECTRON_ENABLE_LOGGING', 'ELECTRON_ENABLE_STACK_DUMPING'
    ])

    constructor() {
        this.windowManager = WindowManagerFactory.create()
        this.instances = new Map()
        this.securityLogger.info('CursorInstanceManager initialized')
    }

    /**
     * Validates instance ID format
     */
    private validateInstanceId(id: string): string {
        if (!id || typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) {
            throw new Error('Invalid instance ID format')
        }
        return id
    }

    /**
     * Validates and sanitizes key input
     */
    private validateKeys(keys: string[]): string[] {
        if (!Array.isArray(keys) || keys.length === 0) {
            throw new Error('Keys must be a non-empty array')
        }

        if (keys.length > 50) {
            throw new Error('Too many keys in sequence (maximum 50)')
        }

        const allowedKeys = /^[a-zA-Z0-9\s\-_.()[\]{}|:;'"<>?!@#$%^&*+=~/\\]|control|shift|alt|command|enter|tab|escape|backspace|delete|space|up|down|left|right$/

        return keys.map(key => {
            if (typeof key !== 'string' || key.length > 20) {
                throw new Error('Invalid key format')
            }
            
            if (!allowedKeys.test(key)) {
                throw new Error(`Invalid key: ${key}`)
            }
            
            return key
        })
    }

    /**
     * Creates a safe environment for process spawning
     */
    private createSafeEnvironment(): Record<string, string> {
        const safeEnv: Record<string, string> = {}
        
        // Copy only safe environment variables
        for (const [key, value] of Object.entries(process.env)) {
            if (this.SAFE_ENV_KEYS.has(key) && typeof value === 'string') {
                safeEnv[key] = value
            }
        }

        // Add required Electron variables
        safeEnv.ELECTRON_ENABLE_LOGGING = '1'
        safeEnv.ELECTRON_ENABLE_STACK_DUMPING = '1'

        return safeEnv
    }

    async create(workspacePath?: string): Promise<CursorInstance> {
        // Check instance limit
        if (this.instances.size >= this.MAX_INSTANCES) {
            throw new Error(`Maximum number of instances (${this.MAX_INSTANCES}) reached`)
        }

        const id = uuidv4()
        this.securityLogger.info('Creating new Cursor instance', { instanceId: id })

        // Validate and sanitize workspace path if provided
        let validatedWorkspacePath: string | undefined
        if (workspacePath) {
            try {
                validatedWorkspacePath = PathResolver.validateWorkspacePath(workspacePath)
                this.securityLogger.debug('Validated workspace path', { 
                    instanceId: id,
                    workspacePath: validatedWorkspacePath 
                })
            } catch (error) {
                this.securityLogger.error('Invalid workspace path provided', { 
                    instanceId: id,
                    workspacePath,
                    error: error instanceof Error ? error.message : String(error)
                })
                throw new Error(`Invalid workspace path: ${error instanceof Error ? error.message : String(error)}`)
            }
        }

        // Get validated Cursor executable path
        let cursorPath: string
        try {
            cursorPath = PathResolver.getCursorExecutablePath()
        } catch (error) {
            this.securityLogger.error('Failed to get Cursor executable path', { 
                instanceId: id,
                error: error instanceof Error ? error.message : String(error)
            })
            throw new Error(`Failed to locate Cursor executable: ${error instanceof Error ? error.message : String(error)}`)
        }

        // Prepare secure spawn arguments
        const args = validatedWorkspacePath ? [validatedWorkspacePath] : []
        const safeEnv = this.createSafeEnvironment()

        // Spawn process with security constraints
        const cursorProcess = spawn(cursorPath, args, {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: false,
            env: safeEnv,
            // Additional security options
            uid: process.getuid?.(), // Maintain user permissions
            gid: process.getgid?.(),
        })

        const instance: CursorInstance & { window?: WindowInfo } = {
            id,
            process: cursorProcess,
            window: undefined,
            isActive: true,
            createdAt: new Date(),
            workspacePath: validatedWorkspacePath
        }

        this.instances.set(id, instance)
        this.securityLogger.info('Cursor process spawned', { 
            instanceId: id,
            processId: cursorProcess.pid 
        })

        // Create a promise that resolves when the window is found or rejects on error
        const windowPromise = new Promise<WindowInfo | undefined>((resolve, reject) => {
            let errorOutput = ''
            let attempts = 0
            const maxAttempts = 10
            const checkInterval = 500 // ms

            // Handle process events with security logging
            cursorProcess.on('error', (error: Error) => {
                this.securityLogger.error('Process error', { 
                    instanceId: id,
                    processId: cursorProcess.pid,
                    error: error.message 
                })
                instance.isActive = false
                reject(new Error(`Failed to start Cursor process: ${error.message}`))
            })

            // Monitor and log stdout with size limits
            cursorProcess.stdout?.on('data', (data: Buffer) => {
                const output = data.toString()
                if (output.length > 10000) { // Limit log size
                    this.securityLogger.warn('Large stdout output truncated', { 
                        instanceId: id,
                        size: output.length 
                    })
                }
                this.securityLogger.debug('Process stdout', { 
                    instanceId: id,
                    output: output.substring(0, 1000) 
                })
            })

            // Monitor and log stderr with security analysis
            cursorProcess.stderr?.on('data', (data: Buffer) => {
                const error = data.toString()
                this.securityLogger.error('Process stderr', { 
                    instanceId: id,
                    error: error.substring(0, 1000) 
                })
                errorOutput += error

                // Check for security-related errors
                const securityKeywords = ['permission', 'access', 'denied', 'unauthorized', 'privilege']
                if (securityKeywords.some(keyword => error.toLowerCase().includes(keyword))) {
                    this.securityLogger.warn('Potential security-related error detected', { 
                        instanceId: id,
                        error: error.substring(0, 500) 
                    })
                }

                // Check for specific error conditions
                if (error.includes('Cannot find module')) {
                    const moduleName = error.match(/Cannot find module '([^']+)'/)?.[1]
                    if (moduleName) {
                        reject(new Error(`Cursor is missing required module: ${moduleName}. Please ensure Cursor is installed correctly with all dependencies.`))
                    }
                }
            })

            cursorProcess.on('exit', (code: number | null) => {
                this.securityLogger.info('Process exited', { 
                    instanceId: id,
                    exitCode: code 
                })
                instance.isActive = false
                this.instances.delete(id)

                // Provide more helpful error message based on exit code
                if (code === 0) {
                    reject(new Error('Cursor process exited normally but window was not created. This may indicate a configuration issue.'))
                } else {
                    reject(new Error(`Cursor process exited with code ${code}. Error output: ${errorOutput.substring(0, 500)}`))
                }
            })

            // Check for window periodically with timeout
            const checkWindow = async () => {
                if (!instance.isActive) {
                    return // Stop checking if process is no longer active
                }

                try {
                    const windowManager = await this.windowManager
                    const window = await windowManager.findWindowByProcessId(cursorProcess.pid!)
                    if (window) {
                        this.securityLogger.info('Window found for instance', { 
                            instanceId: id,
                            windowId: window.id 
                        })
                        resolve(window)
                        return
                    }
                } catch (error) {
                    this.securityLogger.warn('Error checking for window', { 
                        instanceId: id,
                        attempt: attempts + 1,
                        error: error instanceof Error ? error.message : String(error)
                    })
                }

                attempts++
                if (attempts >= maxAttempts) {
                    this.securityLogger.error('Failed to find window after maximum attempts', { 
                        instanceId: id,
                        maxAttempts 
                    })
                    reject(new Error('Failed to find Cursor window after maximum attempts. The process may have failed to start properly.'))
                } else {
                    setTimeout(checkWindow, checkInterval)
                }
            }

            // Start checking for window
            checkWindow()
        })

        try {
            instance.window = await windowPromise
            this.securityLogger.info('Cursor instance created successfully', { 
                instanceId: id,
                hasWindow: !!instance.window 
            })
            return instance
        } catch (error) {
            this.securityLogger.error('Error creating Cursor instance', { 
                instanceId: id,
                error: error instanceof Error ? error.message : String(error)
            })
            instance.isActive = false
            this.instances.delete(id)
            throw error
        }
    }

    get(id: string): CursorInstance | undefined {
        try {
            const validatedId = this.validateInstanceId(id)
            return this.instances.get(validatedId)
        } catch (error) {
            this.securityLogger.warn('Invalid instance ID in get request', { 
                id,
                error: error instanceof Error ? error.message : String(error)
            })
            return undefined
        }
    }

    private getRequired(id: string): CursorInstance & { window?: WindowInfo } {
        const validatedId = this.validateInstanceId(id)
        const instance = this.instances.get(validatedId)
        if (!instance) {
            this.securityLogger.warn('Attempted access to non-existent instance', { instanceId: validatedId })
            throw new Error(`No instance found with id: ${validatedId}`)
        }
        if (!instance.isActive) {
            this.securityLogger.warn('Attempted access to inactive instance', { instanceId: validatedId })
            throw new Error(`Instance ${validatedId} is not active`)
        }
        return instance
    }

    async sendKeyToInstance(id: string, keys: string[]): Promise<void> {
        const validatedKeys = this.validateKeys(keys)
        const instance = this.getRequired(id)
        
        this.securityLogger.debug('Sending keys to instance', { 
            instanceId: id,
            keyCount: validatedKeys.length 
        })
        
        if (!instance.window) {
            throw new Error('Window reference lost')
        }
        
        try {
            const windowManager = await this.windowManager
            await windowManager.sendKeys(instance.window, validatedKeys)
            
            this.securityLogger.debug('Keys sent successfully', { 
                instanceId: id,
                keyCount: validatedKeys.length 
            })
        } catch (error) {
            this.securityLogger.error('Failed to send keys to instance', { 
                instanceId: id,
                error: error instanceof Error ? error.message : String(error)
            })
            throw error
        }
    }

    async openCommandPalette(id: string): Promise<void> {
        const instance = this.getRequired(id)
        
        this.securityLogger.debug('Opening command palette', { instanceId: id })
        
        if (!instance.window) {
            throw new Error('Window reference lost')
        }
        
        try {
            // Send the command palette shortcut (Ctrl+Shift+P or Cmd+Shift+P)
            const modifierKey = process.platform === 'darwin' ? 'command' : 'control'
            const keys = this.validateKeys([modifierKey, 'shift', 'p'])
            
            const windowManager = await this.windowManager
            await windowManager.sendKeys(instance.window, keys)
            
            this.securityLogger.debug('Command palette opened successfully', { instanceId: id })
        } catch (error) {
            this.securityLogger.error('Failed to open command palette', { 
                instanceId: id,
                error: error instanceof Error ? error.message : String(error)
            })
            throw error
        }
    }

    async openClineTab(id: string): Promise<void> {
        const instance = this.getRequired(id)
        
        this.securityLogger.debug('Opening Cline tab', { instanceId: id })
        
        if (!instance.window) {
            throw new Error('Window reference lost')
        }
        
        try {
            // First open command palette
            await this.openCommandPalette(id)
            
            // Wait for command palette to open
            await new Promise(resolve => setTimeout(resolve, 500))
            
            // Type "Cline: Open in New Tab" with validation
            const text = "Cline: Open in New Tab"
            if (text.length > 100) {
                throw new Error('Command text too long')
            }
            
            for (const char of text) {
                if (!/^[a-zA-Z0-9\s:]+$/.test(char)) {
                    throw new Error(`Invalid character in command: ${char}`)
                }
                
                const windowManager = await this.windowManager
                await windowManager.sendKeys(instance.window, [char])
                await new Promise(resolve => setTimeout(resolve, 30))
            }
            
            // Press Enter
            const windowManager = await this.windowManager
            await windowManager.sendKeys(instance.window, ['enter'])
            
            this.securityLogger.info('Cline tab opened successfully', { instanceId: id })
        } catch (error) {
            this.securityLogger.error('Failed to open Cline tab', { 
                instanceId: id,
                error: error instanceof Error ? error.message : String(error)
            })
            throw error
        }
    }

    list(): CursorInstance[] {
        return Array.from(this.instances.values()).map(instance => ({
            id: instance.id,
            process: instance.process,
            isActive: instance.isActive,
            createdAt: instance.createdAt,
            workspacePath: instance.workspacePath
            // Exclude window reference for security
        }))
    }

    remove(id: string): boolean {
        try {
            const validatedId = this.validateInstanceId(id)
            const instance = this.instances.get(validatedId)
            
            if (!instance) {
                this.securityLogger.warn('Attempted to remove non-existent instance', { instanceId: validatedId })
                return false
            }
            
            this.securityLogger.info('Removing instance', { instanceId: validatedId })
            
            // Safely terminate the process
            if (instance.process && !instance.process.killed) {
                try {
                    instance.process.kill('SIGTERM')
                    
                    // Force kill after timeout if needed
                    setTimeout(() => {
                        if (!instance.process.killed) {
                            this.securityLogger.warn('Force killing unresponsive process', { instanceId: validatedId })
                            instance.process.kill('SIGKILL')
                        }
                    }, 5000)
                } catch (error) {
                    this.securityLogger.error('Error terminating process', { 
                        instanceId: validatedId,
                        error: error instanceof Error ? error.message : String(error)
                    })
                }
            }
            
            instance.isActive = false
            const removed = this.instances.delete(validatedId)
            
            this.securityLogger.info('Instance removed', { 
                instanceId: validatedId,
                success: removed 
            })
            
            return removed
        } catch (error) {
            this.securityLogger.error('Error removing instance', { 
                id,
                error: error instanceof Error ? error.message : String(error)
            })
            return false
        }
    }

    /**
     * Cleanup method to safely shutdown all instances
     */
    async cleanup(): Promise<void> {
        this.securityLogger.info('Starting cleanup of all instances', { 
            instanceCount: this.instances.size 
        })
        
        const cleanupPromises = Array.from(this.instances.keys()).map(id => 
            new Promise<void>((resolve) => {
                try {
                    this.remove(id)
                } catch (error) {
                    this.securityLogger.error('Error during cleanup', { 
                        instanceId: id,
                        error: error instanceof Error ? error.message : String(error)
                    })
                } finally {
                    resolve()
                }
            })
        )
        
        await Promise.all(cleanupPromises)
        this.securityLogger.info('Cleanup completed')
    }
}
