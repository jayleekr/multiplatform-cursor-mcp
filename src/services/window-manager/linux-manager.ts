import { WindowInfo } from './types.js'
import { BaseWindowManager } from './base-manager.js'
import * as activeWin from 'active-win'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class LinuxWindowManager extends BaseWindowManager {
    private async runXdotool(command: string): Promise<string> {
        try {
            const { stdout } = await execAsync(`xdotool ${command}`)
            return stdout.trim()
        } catch (error) {
            console.error('Error running xdotool command:', error)
            throw error
        }
    }

    async getAllWindows(): Promise<WindowInfo[]> {
        try {
            // Get all window IDs
            const windowList = await this.runXdotool('search --onlyvisible --name ""')
            const windowIds = windowList.split('\n').filter(Boolean)

            const windows: WindowInfo[] = []
            for (const windowId of windowIds) {
                try {
                    // Get window info
                    const title = await this.runXdotool(`getwindowname ${windowId}`)
                    const pid = await this.runXdotool(`getwindowpid ${windowId}`)
                    const geometry = await this.runXdotool(`getwindowgeometry --shell ${windowId}`)

                    // Parse geometry
                    const bounds: { [key: string]: number } = {}
                    geometry.split('\n').forEach(line => {
                        const [key, value] = line.split('=')
                        bounds[key.toLowerCase()] = parseInt(value, 10)
                    })

                    windows.push({
                        id: parseInt(windowId, 10),
                        title,
                        processId: parseInt(pid, 10),
                        bounds: {
                            x: bounds.x || 0,
                            y: bounds.y || 0,
                            width: bounds.width || 0,
                            height: bounds.height || 0
                        }
                    })
                } catch (error) {
                    console.warn(`Error getting info for window ${windowId}:`, error)
                }
            }

            return windows
        } catch (error) {
            console.error('Error getting all windows:', error)
            return []
        }
    }

    async focusWindow(windowInfo: WindowInfo): Promise<boolean> {
        try {
            // First try to focus using the window ID
            await this.runXdotool(`windowactivate --sync ${windowInfo.id}`)
            
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
            // Send WM_DELETE_WINDOW message
            await this.runXdotool(`windowclose ${windowInfo.id}`)
            return true
        } catch (error) {
            console.error('Error closing window:', error)
            return false
        }
    }

    getPlatformSpecificApi(): any {
        return {
            activeWin,
            xdotool: {
                exec: this.runXdotool.bind(this)
            }
        }
    }
} 