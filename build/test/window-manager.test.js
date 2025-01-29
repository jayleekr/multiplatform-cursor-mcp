import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { WindowManagerFactory } from '../services/window-manager/factory.js';
import { spawn } from 'child_process';
import { PathResolver } from '../utils/path-resolver.js';
describe('WindowManager Tests', () => {
    let windowManager;
    let cursorProcess;
    let cursorWindow;
    beforeEach(async () => {
        // Initialize window manager
        windowManager = await WindowManagerFactory.create();
        // Start Cursor process
        const cursorPath = PathResolver.getCursorExecutablePath();
        cursorProcess = spawn(cursorPath, [], {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        // Wait for window to appear
        cursorWindow = null;
        let attempts = 0;
        while (!cursorWindow && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            cursorWindow = await windowManager.findWindowByProcessId(cursorProcess.pid);
            attempts++;
        }
        assert(cursorWindow, 'Failed to find Cursor window');
    });
    afterEach(async () => {
        // Clean up
        if (cursorProcess) {
            cursorProcess.kill();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    });
    describe('Window Detection', () => {
        it('should find window by process ID', async () => {
            const window = await windowManager.findWindowByProcessId(cursorProcess.pid);
            assert(window, 'Window not found by process ID');
            assert.strictEqual(window.processId, cursorProcess.pid);
        });
        it('should find window by title', async () => {
            const window = await windowManager.findWindowByTitle('Cursor');
            assert(window, 'Window not found by title');
            assert(window.title.includes('Cursor'));
        });
        it('should get active window', async () => {
            await windowManager.focusWindow(cursorWindow);
            const activeWindow = await windowManager.getActiveWindow();
            assert(activeWindow, 'Active window not found');
            assert.strictEqual(activeWindow.processId, cursorProcess.pid);
        });
    });
    describe('Window Actions', () => {
        it('should focus window', async () => {
            const success = await windowManager.focusWindow(cursorWindow);
            assert(success, 'Failed to focus window');
            const activeWindow = await windowManager.getActiveWindow();
            assert.strictEqual(activeWindow?.processId, cursorWindow.processId);
        });
        it('should check if window is responding', async () => {
            const isResponding = await windowManager.isWindowResponding(cursorWindow);
            assert(isResponding, 'Window should be responding');
        });
    });
    describe('Input Automation', () => {
        it('should send keys to window', async () => {
            await assert.doesNotReject(async () => {
                await windowManager.sendKeys(cursorWindow, ['a', 'b', 'c']);
            });
        });
        it('should send mouse click', async () => {
            await assert.doesNotReject(async () => {
                await windowManager.sendMouseClick(100, 100);
            });
        });
    });
    // Platform-specific tests
    if (process.platform === 'win32') {
        describe('Windows-specific', () => {
            it('should handle Windows-specific window attributes', async () => {
                const api = windowManager.getPlatformSpecificApi();
                assert(api, 'Platform-specific API not available');
            });
        });
    }
    if (process.platform === 'darwin') {
        describe('macOS-specific', () => {
            it('should handle AppleScript commands', async () => {
                const api = windowManager.getPlatformSpecificApi();
                assert(api.osascript, 'AppleScript API not available');
            });
        });
    }
    if (process.platform === 'linux') {
        describe('Linux-specific', () => {
            it('should handle xdotool commands', async () => {
                const api = windowManager.getPlatformSpecificApi();
                assert(api.xdotool, 'xdotool API not available');
            });
        });
    }
});
