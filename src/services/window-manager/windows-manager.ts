import { WindowManager, WindowInfo, WindowEvent } from './types.js'
import { windowManager } from 'node-window-manager'
import robot from 'robotjs'
import { EventEmitter } from 'events'

export class WindowsWindowManager implements WindowManager {
    private eventEmitter = new EventEmitter()
    private windowCache = new Map<number, WindowInfo>()

    private convertToWindowInfo(nativeWindow: any): WindowInfo {
        const cached = this.windowCache.get(nativeWindow.processId)
        if (cached) return cached

        const windowInfo: WindowInfo = {
            id: nativeWindow.handle,
            title: nativeWindow.getTitle(),
            processId: nativeWindow.processId,
            bounds: {
                x: nativeWindow.getBounds().x,
                y: nativeWindow.getBounds().y,
                width: nativeWindow.getBounds().width,
                height: nativeWindow.getBounds().height
            }
        }

        this.windowCache.set(nativeWindow.processId, windowInfo)
        return windowInfo
    }

    async getActiveWindow(): Promise<WindowInfo | null> {
        try {
            const windows = windowManager.getWindows()
            const activeWindow = windows.find(w => w.getTitle() === windowManager.getActiveWindow()?.getTitle())
            return activeWindow ? this.convertToWindowInfo(activeWindow) : null
        } catch (error) {
            console.error('Error getting active window:', error)
            return null
        }
    }

    async getAllWindows(): Promise<WindowInfo[]> {
        try {
            const windows = windowManager.getWindows()
            return windows.map(w => this.convertToWindowInfo(w))
        } catch (error) {
            console.error('Error getting all windows:', error)
            return []
        }
    }

    async findWindowByTitle(title: string): Promise<WindowInfo | null> {
        try {
            const windows = windowManager.getWindows()
            const window = windows.find(w => w.getTitle().includes(title))
            return window ? this.convertToWindowInfo(window) : null
        } catch (error) {
            console.error('Error finding window by title:', error)
            return null
        }
    }

    async findWindowByProcessId(processId: number): Promise<WindowInfo | null> {
        try {
            const windows = windowManager.getWindows()
            const window = windows.find(w => w.processId === processId)
            return window ? this.convertToWindowInfo(window) : null
        } catch (error) {
            console.error('Error finding window by process ID:', error)
            return null
        }
    }

    async focusWindow(windowInfo: WindowInfo): Promise<boolean> {
        try {
            const windows = windowManager.getWindows()
            const window = windows.find(w => w.processId === windowInfo.processId)
            if (!window) return false

            window.bringToTop()
            window.show()
            window.restore()

            // Wait for focus change
            await new Promise(resolve => setTimeout(resolve, 500))

            // Verify focus
            const activeWindow = await this.getActiveWindow()
            return activeWindow?.processId === windowInfo.processId
        } catch (error) {
            console.error('Error focusing window:', error)
            return false
        }
    }

    async closeWindow(windowInfo: WindowInfo): Promise<boolean> {
        try {
            const windows = windowManager.getWindows()
            const window = windows.find(w => w.processId === windowInfo.processId)
            if (!window) return false

            // Send Alt+F4 to close the window since there's no direct close method
            await this.sendKeys(windowInfo, ['alt', 'f4'])
            return true
        } catch (error) {
            console.error('Error closing window:', error)
            return false
        }
    }

    async isWindowResponding(windowInfo: WindowInfo): Promise<boolean> {
        try {
            const windows = windowManager.getWindows()
            const window = windows.find(w => w.processId === windowInfo.processId)
            return !!window && window.getTitle().length > 0
        } catch (error) {
            console.error('Error checking window response:', error)
            return false
        }
    }

    on(event: WindowEvent['type'], callback: (event: WindowEvent) => void): void {
        this.eventEmitter.on(event, callback)
    }

    off(event: WindowEvent['type'], callback: (event: WindowEvent) => void): void {
        this.eventEmitter.off(event, callback)
    }

    async sendKeys(windowInfo: WindowInfo, keys: string[]): Promise<void> {
        try {
            await this.focusWindow(windowInfo)
            
            for (const key of keys) {
                robot.keyToggle(key.toLowerCase(), 'down')
                await new Promise(resolve => setTimeout(resolve, 30))
                robot.keyToggle(key.toLowerCase(), 'up')
                await new Promise(resolve => setTimeout(resolve, 30))
            }
        } catch (error) {
            console.error('Error sending keys:', error)
            throw error
        }
    }

    async sendMouseClick(x: number, y: number, button: 'left' | 'right' = 'left'): Promise<void> {
        try {
            robot.moveMouse(x, y)
            robot.mouseClick(button)
        } catch (error) {
            console.error('Error sending mouse click:', error)
            throw error
        }
    }

    getPlatformSpecificApi(): any {
        return windowManager
    }
} 