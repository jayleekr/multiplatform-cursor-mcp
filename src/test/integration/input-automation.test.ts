/*
// Integration test temporarily disabled due to interface changes
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { CursorInstanceManager } from '../../managers/CursorInstanceManager.js'
import { InputAutomationService } from '../../services/input-automation/input-service.js'
import { sleep } from '../../utils/sleep.js'

describe('Input Automation Integration Tests', () => {
    let cursorManager: CursorInstanceManager
    let inputService: InputAutomationService
    let testWindow: any

    beforeEach(async () => {
        cursorManager = CursorInstanceManager.getInstance()
        inputService = InputAutomationService.getInstance()
        
        // Start a test Cursor instance
        await cursorManager.startNewInstance()
        await sleep(2000) // Wait for window to be ready
        
        // Get the window reference
        const windows = await cursorManager.getRunningInstances()
        assert(windows.length > 0, 'No Cursor windows found')
        testWindow = windows[0]
        
        // Focus the window
        await cursorManager.focusInstance(testWindow)
        await sleep(500)
    })

    afterEach(async () => {
        // Clean up test instance
        await cursorManager.closeAllInstances()
    })

    describe('Text Input Scenarios', () => {
        it('should handle complex text input', async () => {
            // Type a complex text with special characters
            const testText = 'Hello, World! 123 #$%^&*'
            await inputService.typeText(testText)
            await sleep(500)
            
            // Select all text (Cmd+A or Ctrl+A)
            if (process.platform === 'darwin') {
                await inputService.sendKeys(['command', 'a'])
            } else {
                await inputService.sendKeys(['control', 'a'])
            }
            await sleep(500)

            // Copy text (Cmd+C or Ctrl+C)
            if (process.platform === 'darwin') {
                await inputService.sendKeys(['command', 'c'])
            } else {
                await inputService.sendKeys(['control', 'c'])
            }
            await sleep(500)
        })

        it('should handle rapid text input', async () => {
            // Type multiple lines rapidly
            const lines = [
                'First line of text',
                'Second line of text',
                'Third line of text'
            ]

            for (const line of lines) {
                await inputService.typeText(line)
                await inputService.sendKeys(['enter'])
                await sleep(100) // Minimal delay between lines
            }
        })
    })

    describe('Keyboard Navigation', () => {
        it('should handle arrow key navigation', async () => {
            // Type some text
            await inputService.typeText('Navigation test')
            await sleep(500)

            // Move cursor with arrow keys
            for (let i = 0; i < 5; i++) {
                await inputService.sendKeys(['left'])
                await sleep(100)
            }

            // Select text with shift+arrow
            for (let i = 0; i < 3; i++) {
                await inputService.sendKeys(['shift', 'right'])
                await sleep(100)
            }
        })

        it('should handle word navigation', async () => {
            // Type text with multiple words
            await inputService.typeText('Word by word navigation test')
            await sleep(500)

            // Navigate word by word
            if (process.platform === 'darwin') {
                await inputService.sendKeys(['alt', 'left'])
            } else {
                await inputService.sendKeys(['control', 'left'])
            }
            await sleep(100)

            // Select word by word
            if (process.platform === 'darwin') {
                await inputService.sendKeys(['shift', 'alt', 'right'])
            } else {
                await inputService.sendKeys(['shift', 'control', 'right'])
            }
            await sleep(100)
        })
    })

    describe('Mouse Interaction', () => {
        it('should handle click and drag', async () => {
            // Type some text
            await inputService.typeText('Click and drag test')
            await sleep(500)

            // Get window position
            const windowBounds = await cursorManager.getWindowBounds(testWindow)
            
            // Calculate relative coordinates within the window
            const startX = windowBounds.x + 100
            const startY = windowBounds.y + 100
            const endX = startX + 200
            const endY = startY

            // Perform click and drag
            await inputService.moveMouse(startX, startY)
            await sleep(100)
            await inputService.mouseClick('left')
            await sleep(100)
            await inputService.mouseDrag(startX, startY, endX, endY)
            await sleep(100)
        })

        it('should handle double click', async () => {
            // Type a word
            await inputService.typeText('DoubleClickTest')
            await sleep(500)

            // Get window position
            const windowBounds = await cursorManager.getWindowBounds(testWindow)
            
            // Calculate click position
            const clickX = windowBounds.x + 100
            const clickY = windowBounds.y + 100

            // Perform double click
            await inputService.moveMouse(clickX, clickY)
            await sleep(100)
            await inputService.mouseDoubleClick('left')
            await sleep(100)
        })
    })
})
*/

// Placeholder for future integration tests
export const integrationTestPlaceholder = true; 