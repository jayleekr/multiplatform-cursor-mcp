import { keyboard, mouse, Point, Button, Key } from '@nut-tree-fork/nut-js'

export class InputAutomationService {
    private static instance: InputAutomationService
    private modifierKeys: Set<string> = new Set()

    private constructor() {
        // Configure nut.js
        keyboard.config.autoDelayMs = 30
        mouse.config.autoDelayMs = 30
        mouse.config.mouseSpeed = 1000
    }

    static getInstance(): InputAutomationService {
        if (!InputAutomationService.instance) {
            InputAutomationService.instance = new InputAutomationService()
        }
        return InputAutomationService.instance
    }

    private getKeyCode(key: string): Key {
        // Map common key names to nut.js key codes
        const keyMap: { [key: string]: Key } = {
            'control': Key.LeftControl,
            'ctrl': Key.LeftControl,
            'shift': Key.LeftShift,
            'alt': Key.LeftAlt,
            'command': Key.LeftCmd,
            'cmd': Key.LeftCmd,
            'enter': Key.Enter,
            'return': Key.Return,
            'tab': Key.Tab,
            'escape': Key.Escape,
            'esc': Key.Escape,
            'backspace': Key.Backspace,
            'delete': Key.Delete,
            'space': Key.Space,
            'up': Key.Up,
            'down': Key.Down,
            'left': Key.Left,
            'right': Key.Right
        }

        return keyMap[key.toLowerCase()] || key.toUpperCase() as unknown as Key
    }

    async pressKey(key: string): Promise<void> {
        const keyCode = this.getKeyCode(key)
        await keyboard.pressKey(keyCode as unknown as string)
    }

    async releaseKey(key: string): Promise<void> {
        const keyCode = this.getKeyCode(key)
        await keyboard.releaseKey(keyCode as unknown as string)
    }

    async typeText(text: string): Promise<void> {
        await keyboard.type(text)
    }

    async sendKeys(keys: string[]): Promise<void> {
        for (const key of keys) {
            const keyCode = this.getKeyCode(key)
            
            // Handle modifier keys specially
            if ([Key.LeftControl, Key.LeftShift, Key.LeftAlt, Key.LeftCmd].includes(keyCode)) {
                if (!this.modifierKeys.has(keyCode)) {
                    await keyboard.pressKey(keyCode as unknown as string)
                    this.modifierKeys.add(keyCode)
                }
                continue
            }

            // For regular keys, press and release
            await keyboard.pressKey(keyCode)
            await keyboard.releaseKey(keyCode as unknown as string)
        }

        // Release any held modifier keys
        for (const modifierKey of this.modifierKeys) {
            await keyboard.releaseKey(modifierKey)
        }
        this.modifierKeys.clear()
    }

    async moveMouse(x: number, y: number): Promise<void> {
        await mouse.setPosition(new Point(x, y))
    }

    async mouseClick(button: 'left' | 'right' = 'left'): Promise<void> {
        const buttonMap = {
            'left': Button.LEFT,
            'right': Button.RIGHT
        }
        await mouse.click(buttonMap[button])
    }

    async mouseDoubleClick(button: 'left' | 'right' = 'left'): Promise<void> {
        const buttonMap = {
            'left': Button.LEFT,
            'right': Button.RIGHT
        }
        await mouse.doubleClick(buttonMap[button])
    }

    async mouseDrag(startX: number, startY: number, endX: number, endY: number): Promise<void> {
        await mouse.setPosition(new Point(startX, startY))
        await mouse.pressButton(Button.LEFT)
        await mouse.setPosition(new Point(endX, endY))
        await mouse.releaseButton(Button.LEFT)
    }

    async scrollWheel(amount: number): Promise<void> {
        await mouse.scrollDown(amount)
    }
}
