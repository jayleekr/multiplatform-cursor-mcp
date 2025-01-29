import { keyboard, mouse, Point, Button } from '@nut-tree/nut-js';
export class InputAutomationService {
    static instance;
    modifierKeys = new Set();
    constructor() {
        // Configure nut.js
        keyboard.config.autoDelayMs = 30;
        mouse.config.autoDelayMs = 30;
        mouse.config.mouseSpeed = 1000;
    }
    static getInstance() {
        if (!InputAutomationService.instance) {
            InputAutomationService.instance = new InputAutomationService();
        }
        return InputAutomationService.instance;
    }
    getKeyCode(key) {
        // Map common key names to nut.js key codes
        const keyMap = {
            'control': 'ControlLeft',
            'ctrl': 'ControlLeft',
            'shift': 'ShiftLeft',
            'alt': 'AltLeft',
            'command': 'MetaLeft',
            'cmd': 'MetaLeft',
            'enter': 'Return',
            'return': 'Return',
            'tab': 'Tab',
            'escape': 'Escape',
            'esc': 'Escape',
            'backspace': 'Backspace',
            'delete': 'Delete',
            'space': 'Space',
            'up': 'ArrowUp',
            'down': 'ArrowDown',
            'left': 'ArrowLeft',
            'right': 'ArrowRight'
        };
        return keyMap[key.toLowerCase()] || key.toUpperCase();
    }
    async pressKey(key) {
        const keyCode = this.getKeyCode(key);
        await keyboard.pressKey(keyCode);
    }
    async releaseKey(key) {
        const keyCode = this.getKeyCode(key);
        await keyboard.releaseKey(keyCode);
    }
    async typeText(text) {
        await keyboard.type(text);
    }
    async sendKeys(keys) {
        for (const key of keys) {
            const keyCode = this.getKeyCode(key);
            // Handle modifier keys specially
            if (['ControlLeft', 'ShiftLeft', 'AltLeft', 'MetaLeft'].includes(keyCode)) {
                if (!this.modifierKeys.has(keyCode)) {
                    await keyboard.pressKey(keyCode);
                    this.modifierKeys.add(keyCode);
                }
                continue;
            }
            // For regular keys, press and release
            await keyboard.pressKey(keyCode);
            await keyboard.releaseKey(keyCode);
        }
        // Release any held modifier keys
        for (const modifierKey of this.modifierKeys) {
            await keyboard.releaseKey(modifierKey);
        }
        this.modifierKeys.clear();
    }
    async moveMouse(x, y) {
        await mouse.setPosition(new Point(x, y));
    }
    async mouseClick(button = 'left') {
        const buttonMap = {
            'left': Button.LEFT,
            'right': Button.RIGHT
        };
        await mouse.click(buttonMap[button]);
    }
    async mouseDoubleClick(button = 'left') {
        const buttonMap = {
            'left': Button.LEFT,
            'right': Button.RIGHT
        };
        await mouse.doubleClick(buttonMap[button]);
    }
    async mouseDrag(startX, startY, endX, endY) {
        await mouse.setPosition(new Point(startX, startY));
        await mouse.pressButton(Button.LEFT);
        await mouse.setPosition(new Point(endX, endY));
        await mouse.releaseButton(Button.LEFT);
    }
    async scrollWheel(amount) {
        await mouse.scrollDown(amount);
    }
}
