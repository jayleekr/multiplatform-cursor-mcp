import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { InputAutomationService } from '../services/input-automation/input-service.js'
import { InputAutomationError } from '../errors/window-manager-errors.js'

describe('Input Automation Tests', () => {
    let inputService: InputAutomationService

    beforeEach(() => {
        inputService = InputAutomationService.getInstance()
    })

    describe('Keyboard Input', () => {
        it('should send single key', async () => {
            await assert.doesNotReject(async () => {
                await inputService.sendKeys(['a'])
            })
        })

        it('should send multiple keys', async () => {
            await assert.doesNotReject(async () => {
                await inputService.sendKeys(['a', 'b', 'c'])
            })
        })

        it('should send modifier keys', async () => {
            await assert.doesNotReject(async () => {
                await inputService.sendKeys(['control', 'c'])
            })
        })

        it('should send special keys', async () => {
            await assert.doesNotReject(async () => {
                await inputService.sendKeys(['enter', 'tab', 'escape'])
            })
        })

        it('should type text', async () => {
            await assert.doesNotReject(async () => {
                await inputService.typeText('Hello, World!')
            })
        })

        it('should handle invalid keys gracefully', async () => {
            await assert.rejects(async () => {
                await inputService.sendKeys(['invalid_key'])
            }, InputAutomationError)
        })
    })

    describe('Mouse Input', () => {
        it('should move mouse', async () => {
            await assert.doesNotReject(async () => {
                await inputService.moveMouse(100, 100)
            })
        })

        it('should click left button', async () => {
            await assert.doesNotReject(async () => {
                await inputService.mouseClick('left')
            })
        })

        it('should click right button', async () => {
            await assert.doesNotReject(async () => {
                await inputService.mouseClick('right')
            })
        })

        it('should double click', async () => {
            await assert.doesNotReject(async () => {
                await inputService.mouseDoubleClick('left')
            })
        })

        it('should drag mouse', async () => {
            await assert.doesNotReject(async () => {
                await inputService.mouseDrag(100, 100, 200, 200)
            })
        })

        it('should scroll wheel', async () => {
            await assert.doesNotReject(async () => {
                await inputService.scrollWheel(100)
            })
        })
    })

    // Platform-specific tests
    if (process.platform === 'darwin') {
        describe('macOS-specific', () => {
            it('should handle Command key', async () => {
                await assert.doesNotReject(async () => {
                    await inputService.sendKeys(['command', 'c'])
                })
            })
        })
    }

    if (process.platform === 'win32') {
        describe('Windows-specific', () => {
            it('should handle Windows key', async () => {
                await assert.doesNotReject(async () => {
                    await inputService.sendKeys(['meta', 'r'])
                })
            })
        })
    }

    if (process.platform === 'linux') {
        describe('Linux-specific', () => {
            it('should handle Super key', async () => {
                await assert.doesNotReject(async () => {
                    await inputService.sendKeys(['super', 'l'])
                })
            })
        })
    }
}) 