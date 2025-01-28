import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { WindowsApiService } from '../services/WindowsApiService.js';
const DEFAULT_CURSOR_PATH = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor', 'Cursor.exe');
export class CursorInstanceManagerImpl {
    windowsApi;
    instances;
    constructor() {
        this.windowsApi = new WindowsApiService();
        this.instances = new Map();
    }
    async create(workspacePath) {
        const id = uuidv4();
        const cursorProcess = spawn(DEFAULT_CURSOR_PATH, workspacePath ? [workspacePath] : [], {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: false,
            env: {
                ...process.env,
                ELECTRON_ENABLE_LOGGING: '1',
                ELECTRON_ENABLE_STACK_DUMPING: '1'
            }
        });
        const instance = {
            id,
            process: cursorProcess,
            window: undefined,
            isActive: true,
            createdAt: new Date(),
            workspacePath
        };
        this.instances.set(id, instance);
        // Create a promise that resolves when the window is found or rejects on error
        const windowPromise = new Promise((resolve, reject) => {
            let errorOutput = '';
            let attempts = 0;
            const maxAttempts = 10;
            const checkInterval = 500; // ms
            // Handle process events
            cursorProcess.on('error', (error) => {
                console.error('Process error:', error);
                instance.isActive = false;
                reject(new Error(`Failed to start Cursor process: ${error.message}`));
            });
            // Log stdout and stderr
            cursorProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                console.log('Process stdout for instance', id + ':', output);
            });
            cursorProcess.stderr?.on('data', (data) => {
                const error = data.toString();
                console.error('Process stderr for instance', id + ':', error);
                errorOutput += error;
                // Check for specific error conditions
                if (error.includes('Cannot find module')) {
                    const moduleName = error.match(/Cannot find module '([^']+)'/)?.[1];
                    if (moduleName) {
                        reject(new Error(`Cursor is missing required module: ${moduleName}. Please ensure Cursor is installed correctly with all dependencies.`));
                    }
                }
            });
            cursorProcess.on('exit', (code) => {
                console.log('Process exited for instance', id, 'with code:', code);
                instance.isActive = false;
                this.instances.delete(id);
                // Provide more helpful error message based on exit code
                if (code === 0) {
                    reject(new Error('Cursor process exited normally but window was not created. This may indicate a configuration issue.'));
                }
                else {
                    reject(new Error(`Cursor process exited with code ${code}. Error output: ${errorOutput}`));
                }
            });
            // Check for window periodically
            const checkWindow = async () => {
                if (!instance.isActive) {
                    return; // Stop checking if process is no longer active
                }
                try {
                    const window = await this.windowsApi.findWindowByProcessId(cursorProcess.pid, { initialCreation: true });
                    if (window) {
                        resolve(window);
                        return;
                    }
                }
                catch (error) {
                    console.warn('Error checking for window:', error);
                }
                attempts++;
                if (attempts >= maxAttempts) {
                    reject(new Error('Failed to find Cursor window after maximum attempts. The process may have failed to start properly.'));
                }
                else {
                    setTimeout(checkWindow, checkInterval);
                }
            };
            // Start checking for window
            checkWindow();
        });
        try {
            instance.window = await windowPromise;
            return instance;
        }
        catch (error) {
            console.error('Error creating Cursor instance:', error);
            instance.isActive = false;
            this.instances.delete(id);
            throw error;
        }
    }
    get(id) {
        return this.instances.get(id);
    }
    getRequired(id) {
        const instance = this.instances.get(id);
        if (!instance) {
            throw new Error(`No instance found with id: ${id}`);
        }
        return instance;
    }
    async findWindow(id, pid) {
        let window = null;
        let attempts = 0;
        while (!window && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            window = await this.windowsApi.findWindowByProcessId(pid, { initialCreation: true });
            attempts++;
        }
        if (!window) {
            throw new Error('Failed to find Cursor window after launch');
        }
        return window;
    }
    async sendCharToInstance(id, char) {
        const instance = this.getRequired(id);
        if (!instance.window) {
            throw new Error('Window reference lost');
        }
        const keyCode = await this.windowsApi.getVirtualKeyForChar(char);
        await this.sendKeyToInstance(id, keyCode);
    }
    async sendKeyToInstance(id, virtualKey) {
        const instance = this.getRequired(id);
        if (!instance.window) {
            throw new Error('Window reference lost');
        }
        await this.windowsApi.sendKeyToWindow(instance.window, virtualKey);
    }
    async openCommandPalette(id) {
        const instance = this.getRequired(id);
        if (!instance.window) {
            throw new Error('Window reference lost');
        }
        await this.windowsApi.openCommandPalette(instance.window);
    }
    async openClineTab(id) {
        const instance = this.getRequired(id);
        if (!instance.window) {
            throw new Error('Window reference lost');
        }
        await this.windowsApi.openClineTab(instance.window);
    }
    list() {
        return Array.from(this.instances.values());
    }
    remove(id) {
        const instance = this.instances.get(id);
        if (!instance)
            return false;
        // Kill the process if it's still active
        if (instance.isActive) {
            try {
                instance.process.kill();
            }
            catch (error) {
                console.error('Error killing process:', error);
            }
        }
        // Remove from instances
        this.instances.delete(id);
        return true;
    }
}
