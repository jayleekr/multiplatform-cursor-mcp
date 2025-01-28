import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { WindowManager } from '../../managers/window-manager.js'
import { CursorInstanceManager } from '../../managers/cursor-instance-manager.js'
import { InputAutomationService } from '../../services/input-automation/input-service.js'
import { sleep } from '../../utils/sleep.js'

describe('Window Management Integration Tests', () => {
    let windowManager: WindowManager
    let cursorManager: CursorInstanceManager
    let inputService: InputAutomationService
    let testWindow: any

    beforeEach(async () => {
        windowManager = WindowManager.getInstance()
        cursorManager = CursorInstanceManager.getInstance()
        inputService = InputAutomationService.getInstance()
        
        // Start a test Cursor instance
        await cursorManager.startNewInstance()
        await sleep(2000) // Wait for window to be ready
        
        // Get the window reference
        const windows = await windowManager.findCursorWindows()
        assert(windows.length > 0, 'No Cursor windows found')
        testWindow = windows[0]
    })

    afterEach(async () => {
        // Clean up test instance
        await cursorManager.closeAllInstances()
    })

    describe('Window Focus and Input', () => {
        it('should focus window and send keys', async () => {
            // Focus the window
            await windowManager.focusWindow(testWindow)
            await sleep(500)

            // Verify window is focused
            const focusedWindow = await windowManager.getFocusedWindow()
            assert(focusedWindow.id === testWindow.id, 'Window not focused correctly')

            // Send some keystrokes
            await inputService.typeText('test input')
            await sleep(500)

            // Verify text was entered (this would depend on your specific UI verification method)
            // For now, we just verify no errors were thrown
        })

        it('should handle window state changes', async () => {
            // Minimize window
            await windowManager.minimizeWindow(testWindow)
            await sleep(500)
            
            // Verify window is minimized
            const isMinimized = await windowManager.isWindowMinimized(testWindow)
            assert(isMinimized, 'Window not minimized')

            // Restore window
            await windowManager.restoreWindow(testWindow)
            await sleep(500)

            // Verify window is restored
            const isRestored = !await windowManager.isWindowMinimized(testWindow)
            assert(isRestored, 'Window not restored')
        })
    })

    describe('Multi-Window Management', () => {
        it('should handle multiple instances', async () => {
            // Start another instance
            await cursorManager.startNewInstance()
            await sleep(2000)

            // Verify we can find both windows
            const windows = await windowManager.findCursorWindows()
            assert(windows.length === 2, 'Expected 2 Cursor windows')

            // Focus each window in sequence
            for (const window of windows) {
                await windowManager.focusWindow(window)
                await sleep(500)
                
                const focusedWindow = await windowManager.getFocusedWindow()
                assert(focusedWindow.id === window.id, 'Window focus switching failed')
            }
        })
    })

    describe('Error Recovery', () => {
        it('should handle invalid window references gracefully', async () => {
            const invalidWindow = { id: 'invalid', title: 'Invalid Window' }
            
            await assert.rejects(
                async () => await windowManager.focusWindow(invalidWindow),
                /Window not found/
            )
        })

        it('should recover from window close', async () => {
            // Close the window
            await windowManager.closeWindow(testWindow)
            await sleep(1000)

            // Verify window is removed from list
            const windows = await windowManager.findCursorWindows()
            assert(!windows.some(w => w.id === testWindow.id), 'Window still in list after closing')

            // Start a new instance
            await cursorManager.startNewInstance()
            await sleep(2000)

            // Verify we can get a new window
            const newWindows = await windowManager.findCursorWindows()
            assert(newWindows.length > 0, 'Failed to start new instance after closing')
        })
    })
}) 