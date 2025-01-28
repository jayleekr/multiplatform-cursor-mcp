import { WindowInfo } from './types.js'
import { BaseWindowManager } from './base-manager.js'
import * as activeWin from 'active-win'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class MacOSWindowManager extends BaseWindowManager {
    async getAllWindows(): Promise<WindowInfo[]> {
        try {
            // Use osascript to get all windows
            const { stdout } = await execAsync(`
                osascript -e '
                    tell application "System Events"
                        set windowList to {}
                        repeat with proc in (every process whose background only is false)
                            set procName to name of proc
                            set procID to unix id of proc
                            repeat with w in (every window of proc)
                                set end of windowList to {title:name of w, pid:procID}
                            end repeat
                        end repeat
                        return windowList
                    end tell'
            `)

            // Parse the AppleScript output
            const windows = stdout.trim()
                .split(',')
                .map(line => {
                    const match = line.match(/title:(.*?), pid:(\d+)/)
                    if (match) {
                        return {
                            title: match[1].trim(),
                            processId: parseInt(match[2], 10)
                        }
                    }
                    return null
                })
                .filter((w): w is { title: string; processId: number } => w !== null)

            // Convert to WindowInfo format
            return windows.map(w => ({
                id: w.processId,
                title: w.title,
                processId: w.processId
            }))
        } catch (error) {
            console.error('Error getting all windows:', error)
            return []
        }
    }

    async focusWindow(windowInfo: WindowInfo): Promise<boolean> {
        try {
            await execAsync(`
                osascript -e '
                    tell application "System Events"
                        set proc to first process whose unix id is ${windowInfo.processId}
                        set frontmost of proc to true
                        repeat with w in (every window of proc)
                            if name of w contains "${windowInfo.title}" then
                                set index of w to 1
                                return true
                            end if
                        end repeat
                    end tell'
            `)
            
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
            await execAsync(`
                osascript -e '
                    tell application "System Events"
                        set proc to first process whose unix id is ${windowInfo.processId}
                        repeat with w in (every window of proc)
                            if name of w contains "${windowInfo.title}" then
                                click button 1 of w
                                return true
                            end if
                        end repeat
                    end tell'
            `)
            return true
        } catch (error) {
            console.error('Error closing window:', error)
            return false
        }
    }

    getPlatformSpecificApi(): any {
        return {
            activeWin,
            osascript: {
                exec: execAsync
            }
        }
    }
} 