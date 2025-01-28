import * as activeWin from 'active-win'
import clipboard from 'clipboardy'
import robot from 'robotjs'

// Maximum retry attempts for window operations
const MAX_RETRIES = 3
const RETRY_DELAY = 500 // ms
const OPERATION_TIMEOUT = 10000 // 10 seconds max for any operation

// Keyboard event types that match node-window-manager's supported types
export type KeyboardEventType = 'keyDown' | 'keyUp'

export const KeyboardEventTypes = {
    KeyDown: 'keyDown' as const,
    KeyUp: 'keyUp' as const
}

interface KeyboardEvent {
    type: KeyboardEventType
    keyCode: number
    modifiers?: {
        alt?: boolean
        ctrl?: boolean
        shift?: boolean
    }
}

export class WindowsApiService {
    // Track windows created by our tool
    private managedWindows = new Set<number>()

    // Register a window as managed by our tool
    registerManagedWindow(processId: number) {
        this.managedWindows.add(processId)
    }

    // Check if a window is managed by our tool
    isManagedWindow(processId: number): boolean {
        return this.managedWindows.has(processId)
    }

    private async withTimeout<T>(operation: () => Promise<T>, timeoutMs: number = OPERATION_TIMEOUT): Promise<T> {
        const timeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
        })
        
        return Promise.race([operation(), timeout])
    }

    private async verifyWindow(window: activeWin.Result, options: { initialCreation?: boolean } = {}): Promise<boolean> {
        return this.withTimeout(async () => {
            try {
                // Check if window still exists
                const activeWindow = await activeWin.activeWindow()
                const exists = activeWindow && activeWindow.owner.processId === window.owner.processId
                
                if (!exists) return false

                // During initial creation, we only check if the window exists
                if (options.initialCreation) {
                    return true
                }

                // For established windows, verify it's managed by us
                if (!this.isManagedWindow(window.owner.processId)) {
                    return false
                }

                // Verify it's a Cursor window by checking title
                const title = activeWindow.title
                if (!title.includes('Cursor')) {
                    return false
                }

                return true
            } catch (error) {
                console.error('Error verifying window:', error)
                return false
            }
        })
    }

    private async withRetry<T>(
        operation: () => Promise<T>,
        window: activeWin.Result,
        options: { requireFocus?: boolean } = {}
    ): Promise<T> {
        const { requireFocus = false } = options
        let lastError: Error | undefined

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Verify window is valid
                if (!await this.isWindowResponding(window)) {
                    throw new Error('Window is not responding')
                }

                // Focus window if required
                if (requireFocus) {
                    await this.focusWindow(window)
                }

                // Execute the operation
                return await operation()
            } catch (error) {
                lastError = error as Error
                console.error(`Operation failed (attempt ${attempt}/${MAX_RETRIES}):`, error)
                
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
                }
            }
        }

        throw lastError || new Error('Operation failed after retries')
    }

    private async withWindowContext<T>(window: activeWin.Result, operation: () => Promise<T>): Promise<T> {
        try {
            // Perform the operation
            const result = await operation()
            return result
        } catch (error) {
            throw error
        }
    }

    async findWindowByProcessId(processId: number, options: { initialCreation?: boolean } = {}): Promise<activeWin.Result | null> {
        try {
            const activeWindow = await activeWin.activeWindow()
            const window = activeWindow && activeWindow.owner.processId === processId ? activeWindow : null
            
            if (window) {
                // For initial creation, register the window as managed
                if (options.initialCreation) {
                    this.registerManagedWindow(processId)
                }
                
                if (await this.verifyWindow(window, options)) {
                    return window
                }
            }
            return null
        } catch (error) {
            console.error('Error finding window:', error)
            return null
        }
    }

    async findWindowByUuid(uuid: string): Promise<activeWin.Result | null> {
        try {
            const activeWindow = await activeWin.activeWindow()
            if (activeWindow && activeWindow.title.includes('Cursor')) {
                return activeWindow
            }
            return null
        } catch (error) {
            console.error('Error finding window by UUID:', error)
            return null
        }
    }

    async focusWindow(window: activeWin.Result): Promise<boolean> {
        return this.withRetry(async () => {
            // Verify focus was obtained
            await new Promise(resolve => setTimeout(resolve, 100))
            const title = window.title
            if (!title) {
                throw new Error('Failed to obtain window focus')
            }
            
            return true
        }, window)
    }

    async sendKeyToWindow(window: activeWin.Result, keyCode: number, modifiers?: KeyboardEvent['modifiers']): Promise<void> {
        await this.withRetry(async () => {
            // Ensure window is focused before sending keys
            await this.ensureWindowFocus(window)
            
            // Verify window is still valid and responding
            if (!await this.isWindowResponding(window)) {
                throw new Error('Window is not responding')
            }
            
            // Send key down event
            await this.simulateKeyboardEvent(window, {
                type: KeyboardEventTypes.KeyDown,
                keyCode,
                modifiers
            })

            // Small delay between down and up
            await new Promise(resolve => setTimeout(resolve, 50))

            // Send key up event
            await this.simulateKeyboardEvent(window, {
                type: KeyboardEventTypes.KeyUp,
                keyCode,
                modifiers
            })
        }, window, { requireFocus: true })
    }

    private async ensureWindowFocus(window: activeWin.Result): Promise<void> {
        // Small delay to allow window manager to process
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Verify window is actually focused by checking title
        const title = window.title
        if (!title) {
            // If not focused, try alternative method using screen coordinates
            const screen = robot.getScreenSize()
            const centerX = Math.floor(screen.width / 2)
            const centerY = Math.floor(screen.height / 2)
            
            // Move mouse to center of screen and click
            robot.moveMouse(centerX, centerY)
            robot.mouseClick()
            
            // Additional delay to ensure focus
            await new Promise(resolve => setTimeout(resolve, 100))
            
            // Final verification
            const finalTitle = window.title
            if (!finalTitle) {
                throw new Error('Failed to focus window after multiple attempts')
            }
        }
    }

    async simulateKeyboardEvent(window: activeWin.Result, event: KeyboardEvent): Promise<void> {
        const { type, keyCode, modifiers = {} } = event
        const { alt, ctrl, shift } = modifiers

        try {
            // Ensure we're focused on the right window
            await this.ensureWindowFocus(window)

            const key = String.fromCharCode(keyCode).toLowerCase()
            if (!key) {
                throw new Error(`Unsupported key code: ${keyCode}`)
            }

            // Toggle the key
            robot.keyToggle(key, type === KeyboardEventTypes.KeyDown ? 'down' : 'up')

            // Small delay after event to ensure processing
            await new Promise(resolve => setTimeout(resolve, 30))
        } catch (error) {
            console.error('Error simulating keyboard event:', error)
            throw error
        }
    }

    async openCommandPalette(window: activeWin.Result): Promise<void> {
        await this.withRetry(async () => {
            try {
                // Ensure we're focused on the right window
                await this.ensureWindowFocus(window)

                // Press Ctrl+Shift+P using only robotjs
                robot.keyToggle('control', 'down')
                await new Promise(resolve => setTimeout(resolve, 50))
                
                robot.keyToggle('shift', 'down')
                await new Promise(resolve => setTimeout(resolve, 50))
                
                robot.keyToggle('p', 'down')
                await new Promise(resolve => setTimeout(resolve, 50))

                // Release in reverse order with delays
                robot.keyToggle('p', 'up')
                await new Promise(resolve => setTimeout(resolve, 50))
                
                robot.keyToggle('shift', 'up')
                await new Promise(resolve => setTimeout(resolve, 50))
                
                robot.keyToggle('control', 'up')
                await new Promise(resolve => setTimeout(resolve, 50))

                // Wait for command palette to appear
                await new Promise(resolve => setTimeout(resolve, 500))
            } catch (error) {
                console.error('Error opening command palette:', error)
                throw error
            }
        }, window)
    }

    async getVirtualKeyForChar(char: string): Promise<number> {
        const upperChar = char.toUpperCase()
        if (upperChar === ' ') return 32 // Space key code
        if (upperChar === ':') return 186 // Colon key code
        if (upperChar >= 'A' && upperChar <= 'Z') {
            return upperChar.charCodeAt(0)
        }
        throw new Error(`No virtual key code for character: ${char}`)
    }

    async getWindowTitle(window: activeWin.Result): Promise<string> {
        try {
            return window.title
        } catch (error) {
            console.error('Error getting window title:', error)
            return ''
        }
    }

    async isWindowResponding(window: activeWin.Result): Promise<boolean> {
        try {
            const title = window.title
            return title.length > 0
        } catch (error) {
            console.error('Error checking window state:', error)
            return false
        }
    }

    async openClineTab(window: activeWin.Result): Promise<void> {
        await this.withRetry(async () => {
            // 1. Open command palette
            await this.openCommandPalette(window)
            await new Promise(resolve => setTimeout(resolve, 500))

            // 2. Type "Cline: Open in New Tab"
            const text = "Cline: Open in New Tab"
            for (const char of text) {
                const keyCode = await this.getVirtualKeyForChar(char)
                await this.simulateKeyboardEvent(window, {
                    type: KeyboardEventTypes.KeyDown,
                    keyCode
                })
                await new Promise(resolve => setTimeout(resolve, 30))
                await this.simulateKeyboardEvent(window, {
                    type: KeyboardEventTypes.KeyUp,
                    keyCode
                })
                await new Promise(resolve => setTimeout(resolve, 30))
            }

            // 3. Press Enter
            await this.simulateKeyboardEvent(window, {
                type: KeyboardEventTypes.KeyDown,
                keyCode: 13 // Enter key code
            })
            await new Promise(resolve => setTimeout(resolve, 30))
            await this.simulateKeyboardEvent(window, {
                type: KeyboardEventTypes.KeyUp,
                keyCode: 13 // Enter key code
            })

            // Wait for command to execute
            await new Promise(resolve => setTimeout(resolve, 500))
        }, window)
    }
}
