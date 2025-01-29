 import { CursorInstance } from '../types/cursor.js'
import path from 'path'
import { spawn } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import { WindowManager, WindowInfo } from '../services/window-manager/types.js'
import { WindowManagerFactory } from '../services/window-manager/factory.js'
import { PathResolver } from '../utils/path-resolver.js'

export interface CursorInstanceManager {
    create(workspacePath?: string): Promise<CursorInstance>
    get(id: string): CursorInstance | undefined
    sendKeyToInstance(id: string, keys: string[]): Promise<void>
    openCommandPalette(id: string): Promise<void>
    openClineTab(id: string): Promise<void>
    list(): CursorInstance[]
    remove(id: string): boolean
}

export class CursorInstanceManagerImpl implements CursorInstanceManager {
    private windowManager: Promise<WindowManager>
    private instances: Map<string, CursorInstance & { window?: WindowInfo }>

    constructor() {
        this.windowManager = WindowManagerFactory.create()
        this.instances = new Map()
    }

    async create(workspacePath?: string): Promise<CursorInstance> {
        const id = uuidv4()
        const cursorPath = PathResolver.getCursorExecutablePath()
        
        const cursorProcess = spawn(cursorPath, workspacePath ? [workspacePath] : [], {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: false,
            env: {
                ...process.env,
                ELECTRON_ENABLE_LOGGING: '1',
                ELECTRON_ENABLE_STACK_DUMPING: '1'
            }
        })

        const instance: CursorInstance & { window?: WindowInfo } = {
            id,
            process: cursorProcess,
            window: undefined,
            isActive: true,
            createdAt: new Date(),
            workspacePath
        }

        this.instances.set(id, instance)

        // Create a promise that resolves when the window is found or rejects on error
        const windowPromise = new Promise<WindowInfo | undefined>((resolve, reject) => {
            let errorOutput = ''
            let attempts = 0
            const maxAttempts = 10
            const checkInterval = 500 // ms

            // Handle process events
            cursorProcess.on('error', (error: Error) => {
                console.error('Process error:', error)
                instance.isActive = false
                reject(new Error(`Failed to start Cursor process: ${error.message}`))
            })

            // Log stdout and stderr
            cursorProcess.stdout?.on('data', (data: Buffer) => {
                const output = data.toString()
                console.log('Process stdout for instance', id + ':', output)
            })

            cursorProcess.stderr?.on('data', (data: Buffer) => {
                const error = data.toString()
                console.error('Process stderr for instance', id + ':', error)
                errorOutput += error

                // Check for specific error conditions
                if (error.includes('Cannot find module')) {
                    const moduleName = error.match(/Cannot find module '([^']+)'/)?.[1]
                    if (moduleName) {
                        reject(new Error(`Cursor is missing required module: ${moduleName}. Please ensure Cursor is installed correctly with all dependencies.`))
                    }
                }
            })

            cursorProcess.on('exit', (code: number | null) => {
                console.log('Process exited for instance', id, 'with code:', code)
                instance.isActive = false
                this.instances.delete(id)

                // Provide more helpful error message based on exit code
                if (code === 0) {
                    reject(new Error('Cursor process exited normally but window was not created. This may indicate a configuration issue.'))
                } else {
                    reject(new Error(`Cursor process exited with code ${code}. Error output: ${errorOutput}`))
                }
            })

            // Check for window periodically
            const checkWindow = async () => {
                if (!instance.isActive) {
                    return // Stop checking if process is no longer active
                }

                try {
                    const windowManager = await this.windowManager
                    const window = await windowManager.findWindowByProcessId(cursorProcess.pid!)
                    if (window) {
                        resolve(window)
                        return
                    }
                } catch (error) {
                    console.warn('Error checking for window:', error)
                }

                attempts++
                if (attempts >= maxAttempts) {
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
            return instance
        } catch (error) {
            console.error('Error creating Cursor instance:', error)
            instance.isActive = false
            this.instances.delete(id)
            throw error
        }
    }

    get(id: string): CursorInstance | undefined {
        return this.instances.get(id)
    }

    private getRequired(id: string): CursorInstance & { window?: WindowInfo } {
        const instance = this.instances.get(id)
        if (!instance) {
            throw new Error(`No instance found with id: ${id}`)
        }
        return instance
    }

    async sendKeyToInstance(id: string, keys: string[]): Promise<void> {
        const instance = this.getRequired(id)
        if (!instance.window) {
            throw new Error('Window reference lost')
        }
        const windowManager = await this.windowManager
        await windowManager.sendKeys(instance.window, keys)
    }

    async openCommandPalette(id: string): Promise<void> {
        const instance = this.getRequired(id)
        if (!instance.window) {
            throw new Error('Window reference lost')
        }
        // Send the command palette shortcut (Ctrl+Shift+P or Cmd+Shift+P)
        const modifierKey = process.platform === 'darwin' ? 'command' : 'control'
        const windowManager = await this.windowManager
        await windowManager.sendKeys(instance.window, [modifierKey, 'shift', 'p'])
    }

    async openClineTab(id: string): Promise<void> {
        const instance = this.getRequired(id)
        if (!instance.window) {
            throw new Error('Window reference lost')
        }
        
        // First open command palette
        await this.openCommandPalette(id)
        
        // Wait for command palette to open
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Type "Cline: Open in New Tab"
        const text = "Cline: Open in New Tab"
        for (const char of text) {
            const windowManager = await this.windowManager
            await windowManager.sendKeys(instance.window, [char])
            await new Promise(resolve => setTimeout(resolve, 30))
        }
        
        // Press Enter
        const windowManager = await this.windowManager
        await windowManager.sendKeys(instance.window, ['enter'])
    }

    list(): CursorInstance[] {
        return Array.from(this.instances.values())
    }

    remove(id: string): boolean {
        const instance = this.instances.get(id)
        if (!instance) return false

        // Kill the process if it's still active
        if (instance.isActive) {
            try {
                instance.process.kill()
            } catch (error) {
                console.error('Error killing process:', error)
            }
        }

        // Remove from instances
        this.instances.delete(id)
        return true
    }
}
