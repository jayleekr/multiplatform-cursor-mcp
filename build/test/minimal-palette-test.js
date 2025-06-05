import { InputAutomationService } from '../services/input-automation/input-service.js';
import { spawn } from 'child_process';
import path from 'path';
import { windowManager } from 'node-window-manager';
const DEFAULT_CURSOR_PATH = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor', 'Cursor.exe');
async function findCursorWindow() {
    const windows = windowManager.getWindows();
    return windows.find(w => w.getTitle().includes('Cursor'));
}
async function ensureCursorFocus(cursorWindow) {
    // Get currently active window
    const windows = windowManager.getWindows();
    const activeWindow = windows.find(w => w.getTitle().includes('Cursor'));
    // Check if Cursor is already focused
    if (activeWindow) {
        return true;
    }
    // If not focused, try to restore focus
    console.log('Restoring Cursor window focus...');
    cursorWindow.bringToTop();
    cursorWindow.show();
    cursorWindow.restore();
    // Wait for focus change
    await new Promise(resolve => setTimeout(resolve, 500));
    // Verify focus was restored
    const newWindows = windowManager.getWindows();
    const newActiveWindow = newWindows.find(w => w.getTitle().includes('Cursor'));
    return !!newActiveWindow;
}
async function typeText(text, cursorWindow) {
    const inputService = InputAutomationService.getInstance();
    for (const char of text) {
        // Ensure focus before each keystroke
        if (!await ensureCursorFocus(cursorWindow)) {
            console.log('Failed to maintain Cursor window focus');
            throw new Error('Lost window focus');
        }
        // Handle uppercase letters
        if (char >= 'A' && char <= 'Z') {
            await inputService.sendKeys(['shift', char.toLowerCase()]);
        }
        // Handle special characters
        else if (char === ':') {
            await inputService.sendKeys(['shift', ';']); // On most keyboards, shift+; gives :
        }
        // Handle spaces
        else if (char === ' ') {
            await inputService.pressKey('space');
        }
        // Handle normal lowercase letters
        else {
            await inputService.pressKey(char);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}
async function openCommandPalette() {
    try {
        console.log('Opening command palette with Ctrl+Shift+P...');
        const inputService = InputAutomationService.getInstance();
        await inputService.sendKeys(['control', 'shift', 'p']);
        console.log('Command palette opened successfully');
    }
    catch (error) {
        console.error('Failed to open command palette:', error);
    }
}
async function testCommandPalette() {
    try {
        console.log('Launching Cursor...');
        const cursorProcess = spawn(DEFAULT_CURSOR_PATH, [], {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: false
        });
        // Wait for Cursor to start
        console.log('Waiting for Cursor to initialize...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Find the Cursor window
        const cursorWindow = await findCursorWindow();
        if (!cursorWindow) {
            throw new Error('Could not find Cursor window');
        }
        // Initial focus
        console.log('Focusing Cursor window...');
        if (!await ensureCursorFocus(cursorWindow)) {
            throw new Error('Failed to focus Cursor window');
        }
        console.log('Sending Ctrl+Shift+P...');
        const inputService = InputAutomationService.getInstance();
        // Press Ctrl+Shift+P using input service
        await inputService.sendKeys(['control', 'shift', 'p']);
        console.log('Command palette shortcut sent!');
        // Wait for command palette to appear
        await new Promise(resolve => setTimeout(resolve, 500));
        // Type the command with focus checks
        console.log('Typing command...');
        await typeText('Cline: Open in New Tab', cursorWindow);
        // Wait briefly after typing
        await new Promise(resolve => setTimeout(resolve, 500));
        // Ensure focus before Enter
        if (!await ensureCursorFocus(cursorWindow)) {
            throw new Error('Lost window focus before pressing Enter');
        }
        // Press Enter
        console.log('Pressing Enter...');
        await inputService.pressKey('enter');
        // Keep process alive briefly to observe result
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Cleanup
        console.log('Cleaning up...');
        cursorProcess.kill();
    }
    catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}
// Run the test
testCommandPalette().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
openCommandPalette();
