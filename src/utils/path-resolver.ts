import path from 'path'
import os from 'os'

export class PathResolver {
    static getCursorExecutablePath(): string {
        switch (process.platform) {
            case 'win32':
                return path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor', 'Cursor.exe')
            case 'darwin':
                return '/Applications/Cursor.app/Contents/MacOS/Cursor'
            case 'linux':
                // Common Linux installation paths
                const linuxPaths = [
                    path.join(os.homedir(), '.local', 'bin', 'cursor'),
                    '/usr/local/bin/cursor',
                    '/usr/bin/cursor'
                ]
                // Return first existing path or default
                return linuxPaths.find(p => {
                    try {
                        return require('fs').accessSync(p)
                    } catch {
                        return false
                    }
                }) || linuxPaths[0]
            default:
                throw new Error(`Unsupported platform: ${process.platform}`)
        }
    }

    static getDefaultWorkspacePath(): string {
        switch (process.platform) {
            case 'win32':
                return path.join(os.homedir(), 'Documents', 'cursor-workspaces')
            case 'darwin':
            case 'linux':
                return path.join(os.homedir(), '.cursor', 'workspaces')
            default:
                throw new Error(`Unsupported platform: ${process.platform}`)
        }
    }

    static getConfigPath(): string {
        switch (process.platform) {
            case 'win32':
                return path.join(process.env.APPDATA || '', 'cursor-mcp')
            case 'darwin':
                return path.join(os.homedir(), 'Library', 'Application Support', 'cursor-mcp')
            case 'linux':
                return path.join(os.homedir(), '.config', 'cursor-mcp')
            default:
                throw new Error(`Unsupported platform: ${process.platform}`)
        }
    }
} 