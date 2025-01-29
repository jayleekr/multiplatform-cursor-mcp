import { WindowsWindowManager } from './windows-manager.js';
import { MacOSWindowManager } from './macos-manager.js';
import { LinuxWindowManager } from './linux-manager.js';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
export class WindowManagerFactory {
    static async checkDependencies() {
        if (process.platform === 'linux') {
            try {
                await execAsync('which xdotool');
            }
            catch (error) {
                throw new Error('xdotool is required for Linux window management. Please install it using your package manager (e.g., apt-get install xdotool)');
            }
        }
    }
    static async create() {
        await this.checkDependencies();
        switch (process.platform) {
            case 'win32':
                return new WindowsWindowManager();
            case 'darwin':
                return new MacOSWindowManager();
            case 'linux':
                return new LinuxWindowManager();
            default:
                throw new Error(`Unsupported platform: ${process.platform}`);
        }
    }
}
