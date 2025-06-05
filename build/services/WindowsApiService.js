import * as activeWin from 'active-win';
import { InputAutomationService } from './input-automation/input-service.js';
// Maximum retry attempts for window operations
const MAX_RETRIES = 3;
const RETRY_DELAY = 500; // ms
const OPERATION_TIMEOUT = 10000; // 10 seconds max for any operation
export const KeyboardEventTypes = {
    KeyDown: 'keyDown',
    KeyUp: 'keyUp'
};
export class WindowsApiService {
    // Track windows created by our tool
    managedWindows = new Set();
    // Register a window as managed by our tool
    registerManagedWindow(processId) {
        this.managedWindows.add(processId);
    }
    // Check if a window is managed by our tool
    isManagedWindow(processId) {
        return this.managedWindows.has(processId);
    }
    async withTimeout(operation, timeoutMs = OPERATION_TIMEOUT) {
        const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
        });
        return Promise.race([operation(), timeout]);
    }
    async verifyWindow(window, options = {}) {
        return this.withTimeout(async () => {
            try {
                // Check if window still exists
                const activeWindow = await activeWin.activeWindow();
                const exists = activeWindow && activeWindow.owner.processId === window.owner.processId;
                if (!exists)
                    return false;
                // During initial creation, we only check if the window exists
                if (options.initialCreation) {
                    return true;
                }
                // For established windows, verify it's managed by us
                if (!this.isManagedWindow(window.owner.processId)) {
                    return false;
                }
                // Verify it's a Cursor window by checking title
                const title = activeWindow.title;
                if (!title.includes('Cursor')) {
                    return false;
                }
                return true;
            }
            catch (error) {
                console.error('Error verifying window:', error);
                return false;
            }
        });
    }
    async withRetry(operation, window, options = {}) {
        const { requireFocus = false } = options;
        let lastError;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Verify window is valid
                if (!await this.isWindowResponding(window)) {
                    throw new Error('Window is not responding');
                }
                // Focus window if required
                if (requireFocus) {
                    await this.focusWindow(window);
                }
                // Execute the operation
                return await operation();
            }
            catch (error) {
                lastError = error;
                console.error(`Operation failed (attempt ${attempt}/${MAX_RETRIES}):`, error);
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }
        }
        throw lastError || new Error('Operation failed after retries');
    }
    async withWindowContext(window, operation) {
        try {
            // Perform the operation
            const result = await operation();
            return result;
        }
        catch (error) {
            throw error;
        }
    }
    async findWindowByProcessId(processId, options = {}) {
        try {
            const activeWindow = await activeWin.activeWindow();
            const window = activeWindow && activeWindow.owner.processId === processId ? activeWindow : null;
            if (window) {
                // For initial creation, register the window as managed
                if (options.initialCreation) {
                    this.registerManagedWindow(processId);
                }
                if (await this.verifyWindow(window, options)) {
                    return window;
                }
            }
            return null;
        }
        catch (error) {
            console.error('Error finding window:', error);
            return null;
        }
    }
    async findWindowByUuid(uuid) {
        try {
            const activeWindow = await activeWin.activeWindow();
            if (activeWindow && activeWindow.title.includes('Cursor')) {
                return activeWindow;
            }
            return null;
        }
        catch (error) {
            console.error('Error finding window by UUID:', error);
            return null;
        }
    }
    async focusWindow(window) {
        return this.withRetry(async () => {
            // Verify focus was obtained
            await new Promise(resolve => setTimeout(resolve, 100));
            const title = window.title;
            if (!title) {
                throw new Error('Failed to obtain window focus');
            }
            return true;
        }, window);
    }
    async sendKeyToWindow(window, keyCode, modifiers) {
        await this.withRetry(async () => {
            // Ensure window is focused before sending keys
            await this.ensureWindowFocus(window);
            // Verify window is still valid and responding
            if (!await this.isWindowResponding(window)) {
                throw new Error('Window is not responding');
            }
            // Send key down event
            await this.simulateKeyboardEvent(window, {
                type: KeyboardEventTypes.KeyDown,
                keyCode,
                modifiers
            });
            // Small delay between down and up
            await new Promise(resolve => setTimeout(resolve, 50));
            // Send key up event
            await this.simulateKeyboardEvent(window, {
                type: KeyboardEventTypes.KeyUp,
                keyCode,
                modifiers
            });
        }, window, { requireFocus: true });
    }
    async ensureWindowFocus(window) {
        // Small delay to allow window manager to process
        await new Promise(resolve => setTimeout(resolve, 100));
        // Verify window is actually focused by checking title
        const title = window.title;
        if (!title) {
            // If not focused, try alternative method using screen coordinates
            const inputService = InputAutomationService.getInstance();
            // Move mouse to center of screen and click
            const centerX = Math.floor(1920 / 2); // Default screen size, could be improved
            const centerY = Math.floor(1080 / 2);
            await inputService.moveMouse(centerX, centerY);
            await inputService.mouseClick();
            // Additional delay to ensure focus
            await new Promise(resolve => setTimeout(resolve, 100));
            // Final verification
            const finalTitle = window.title;
            if (!finalTitle) {
                throw new Error('Failed to focus window after multiple attempts');
            }
        }
    }
    async simulateKeyboardEvent(window, event) {
        const { type, keyCode, modifiers = {} } = event;
        const { alt, ctrl, shift } = modifiers;
        try {
            // Ensure we're focused on the right window
            await this.ensureWindowFocus(window);
            const inputService = InputAutomationService.getInstance();
            const key = String.fromCharCode(keyCode);
            if (!key) {
                throw new Error(`Unsupported key code: ${keyCode}`);
            }
            // Use input service for key simulation
            if (type === KeyboardEventTypes.KeyDown) {
                await inputService.pressKey(key);
            }
            else {
                await inputService.releaseKey(key);
            }
            // Small delay after event to ensure processing
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        catch (error) {
            console.error('Error simulating keyboard event:', error);
            throw error;
        }
    }
    async openCommandPalette(window) {
        await this.withRetry(async () => {
            try {
                // Ensure we're focused on the right window
                await this.ensureWindowFocus(window);
                const inputService = InputAutomationService.getInstance();
                // Press Ctrl+Shift+P using input service
                await inputService.sendKeys(['control', 'shift', 'p']);
                // Wait for command palette to appear
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            catch (error) {
                console.error('Error opening command palette:', error);
                throw error;
            }
        }, window);
    }
    async getVirtualKeyForChar(char) {
        const upperChar = char.toUpperCase();
        if (upperChar === ' ')
            return 32; // Space key code
        if (upperChar === ':')
            return 186; // Colon key code
        if (upperChar >= 'A' && upperChar <= 'Z') {
            return upperChar.charCodeAt(0);
        }
        throw new Error(`No virtual key code for character: ${char}`);
    }
    async getWindowTitle(window) {
        try {
            return window.title;
        }
        catch (error) {
            console.error('Error getting window title:', error);
            return '';
        }
    }
    async isWindowResponding(window) {
        try {
            const title = window.title;
            return title.length > 0;
        }
        catch (error) {
            console.error('Error checking window state:', error);
            return false;
        }
    }
    async openClineTab(window) {
        await this.withRetry(async () => {
            // 1. Open command palette
            await this.openCommandPalette(window);
            await new Promise(resolve => setTimeout(resolve, 500));
            // 2. Type "Cline: Open in New Tab"
            const text = "Cline: Open in New Tab";
            for (const char of text) {
                const keyCode = await this.getVirtualKeyForChar(char);
                await this.simulateKeyboardEvent(window, {
                    type: KeyboardEventTypes.KeyDown,
                    keyCode
                });
                await new Promise(resolve => setTimeout(resolve, 30));
                await this.simulateKeyboardEvent(window, {
                    type: KeyboardEventTypes.KeyUp,
                    keyCode
                });
                await new Promise(resolve => setTimeout(resolve, 30));
            }
            // 3. Press Enter
            await this.simulateKeyboardEvent(window, {
                type: KeyboardEventTypes.KeyDown,
                keyCode: 13 // Enter key code
            });
            await new Promise(resolve => setTimeout(resolve, 30));
            await this.simulateKeyboardEvent(window, {
                type: KeyboardEventTypes.KeyUp,
                keyCode: 13 // Enter key code
            });
            // Wait for command to execute
            await new Promise(resolve => setTimeout(resolve, 500));
        }, window);
    }
}
