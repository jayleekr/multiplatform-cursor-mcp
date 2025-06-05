import { InputAutomationService } from '../services/input-automation/input-service.js'
import { spawn } from 'child_process'
import path from 'path'
import { windowManager } from 'node-window-manager'
import { getPaletteCommand, CommandSchema } from '../commands/cursor-commands.js'

const DEFAULT_CURSOR_PATH = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor', 'Cursor.exe')

async function findCursorWindow(): Promise<any> {
    const windows = windowManager.getWindows()
    return windows.find(w => w.getTitle().includes('Cursor'))
}

async function ensureCursorFocus(cursorWindow: any): Promise<boolean> {
    // Get currently active window
    const windows = windowManager.getWindows()
    const activeWindow = windows.find(w => w.getTitle().includes('Cursor'))
    
    // Check if Cursor is already focused
    if (activeWindow) {
        return true
    }

    // If not focused, try to restore focus
    console.log('Restoring Cursor window focus...')
    cursorWindow.bringToTop()
    cursorWindow.show()
    cursorWindow.restore()
    
    // Wait for focus change
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Verify focus was restored
    const newWindows = windowManager.getWindows()
    const newActiveWindow = newWindows.find(w => w.getTitle().includes('Cursor'))
    return !!newActiveWindow
}

async function typeText(text: string, cursorWindow: any) {
    const inputService = InputAutomationService.getInstance()
    
    for (const char of text) {
        // Ensure focus before each keystroke
        if (!await ensureCursorFocus(cursorWindow)) {
            console.log('Failed to maintain Cursor window focus')
            throw new Error('Lost window focus')
        }

        // Handle uppercase letters
        if (char >= 'A' && char <= 'Z') {
            await inputService.sendKeys(['shift', char.toLowerCase()])
        }
        // Handle special characters
        else if (char === ':') {
            await inputService.sendKeys(['shift', ';'])  // On most keyboards, shift+; gives :
        }
        // Handle spaces
        else if (char === ' ') {
            await inputService.pressKey('space')
        }
        // Handle normal lowercase letters
        else {
            await inputService.pressKey(char)
        }
        
        await new Promise(resolve => setTimeout(resolve, 50))
    }
}

async function executeCursorCommand(commandName: string) {
    // Validate command
    const parseResult = CommandSchema.safeParse({ command: commandName })
    if (!parseResult.success) {
        throw new Error(`Invalid command: ${commandName}. Available commands: ${Object.keys(CommandSchema.shape.command.enum).join(', ')}`)
    }

    // Get the palette command
    const paletteCommand = getPaletteCommand(commandName)
    if (!paletteCommand) {
        throw new Error(`No palette command found for: ${commandName}`)
    }

    try {
        console.log('Launching Cursor...')
        const cursorProcess = spawn(DEFAULT_CURSOR_PATH, [], {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: false
        })

        // Wait for Cursor to start
        console.log('Waiting for Cursor to initialize...')
        await new Promise(resolve => setTimeout(resolve, 3000))

        // Find the Cursor window
        const cursorWindow = await findCursorWindow()
        if (!cursorWindow) {
            throw new Error('Could not find Cursor window')
        }

        // Initial focus
        console.log('Focusing Cursor window...')
        if (!await ensureCursorFocus(cursorWindow)) {
            throw new Error('Failed to focus Cursor window')
        }
        
        console.log('Opening command palette...')
        
        const inputService = InputAutomationService.getInstance()
        // Press Ctrl+Shift+P using input service
        await inputService.sendKeys(['control', 'shift', 'p'])

        // Wait for command palette to appear
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Type the command with focus checks
        console.log('Executing command:', paletteCommand)
        await typeText(paletteCommand, cursorWindow)
        
        // Wait briefly after typing
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Ensure focus before Enter
        if (!await ensureCursorFocus(cursorWindow)) {
            throw new Error('Lost window focus before pressing Enter')
        }
        
        // Press Enter
        console.log('Confirming command...')
        await inputService.pressKey('enter')
        
        // Keep process alive briefly to observe result
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Cleanup
        console.log('Done!')
        cursorProcess.kill()
        
    } catch (error) {
        console.error('Command failed:', error)
        process.exit(1)
    }
}

// Get command from command line
const commandName = process.argv[2]
if (!commandName) {
    console.log('Available commands:')
    Object.entries(CommandSchema.shape.command.enum).forEach(([cmd]) => {
        console.log(`- ${cmd}`)
    })
    process.exit(0)
}

// Execute the command
console.log(`Executing Cursor command: ${commandName}`)
executeCursorCommand(commandName).catch(error => {
    console.error('Unhandled error:', error)
    process.exit(1)
}) 