import { BaseWindowManager } from './base-manager.js';
import * as activeWin from 'active-win';
import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from '../../utils/logger.js';
const execAsync = promisify(exec);
/**
 * Security-hardened macOS Window Manager
 * Implements multiple layers of security to prevent injection attacks
 */
export class MacOSWindowManager extends BaseWindowManager {
    MAX_TITLE_LENGTH = 500;
    MAX_PROCESS_ID = 999999;
    ALLOWED_CHARACTERS = /^[a-zA-Z0-9\s\-_.()[\]{}|:;'"<>?!@#$%^&*+=~/\\]*$/;
    securityLogger = log.child('MacOSWindowManager-Security');
    /**
     * Validates and sanitizes window title to prevent AppleScript injection
     */
    sanitizeTitle(title) {
        if (!title || typeof title !== 'string') {
            throw new Error('Title must be a non-empty string');
        }
        // Length validation
        if (title.length > this.MAX_TITLE_LENGTH) {
            this.securityLogger.warn('Title length exceeded maximum allowed', {
                titleLength: title.length,
                maxLength: this.MAX_TITLE_LENGTH
            });
            throw new Error(`Title length exceeds maximum allowed (${this.MAX_TITLE_LENGTH})`);
        }
        // Character validation
        if (!this.ALLOWED_CHARACTERS.test(title)) {
            this.securityLogger.warn('Title contains potentially dangerous characters', {
                title: title.substring(0, 100) + '...'
            });
            throw new Error('Title contains invalid characters');
        }
        // Remove dangerous AppleScript sequences
        const dangerous = [
            'tell application',
            'do shell script',
            'system events',
            'activate',
            'quit',
            'delete',
            'move',
            'copy',
            'run script',
            'osascript'
        ];
        const lowerTitle = title.toLowerCase();
        for (const danger of dangerous) {
            if (lowerTitle.includes(danger)) {
                this.securityLogger.warn('Title contains potentially dangerous AppleScript sequence', {
                    sequence: danger,
                    title: title.substring(0, 100) + '...'
                });
                throw new Error(`Title contains forbidden sequence: ${danger}`);
            }
        }
        // Escape special characters for AppleScript
        return title
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }
    /**
     * Validates process ID to prevent injection
     */
    validateProcessId(processId) {
        if (!Number.isInteger(processId) || processId <= 0 || processId > this.MAX_PROCESS_ID) {
            this.securityLogger.warn('Invalid process ID', { processId });
            throw new Error(`Invalid process ID: ${processId}`);
        }
        return processId;
    }
    /**
     * Executes AppleScript with security constraints
     */
    async secureExecAppleScript(script, context) {
        // Validate script doesn't contain dangerous patterns
        const dangerousPatterns = [
            /do shell script/i,
            /system events.*delete/i,
            /system events.*move/i,
            /tell application.*quit/i,
            /run script/i
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(script)) {
                this.securityLogger.error('Attempted execution of dangerous AppleScript', {
                    context,
                    scriptPreview: script.substring(0, 200) + '...'
                });
                throw new Error('Script contains forbidden operations');
            }
        }
        try {
            // Set timeout for script execution (10 seconds max)
            const { stdout } = await execAsync(`osascript -e '${script}'`, {
                timeout: 10000,
                maxBuffer: 1024 * 1024 // 1MB max output
            });
            this.securityLogger.debug('Successfully executed AppleScript', { context });
            return stdout;
        }
        catch (error) {
            this.securityLogger.error('AppleScript execution failed', {
                context,
                error: error instanceof Error ? error.message : String(error)
            });
            throw new Error(`AppleScript execution failed in ${context}`);
        }
    }
    async getAllWindows() {
        try {
            this.securityLogger.debug('Getting all windows');
            const script = `
                tell application "System Events"
                    set windowList to {}
                    repeat with proc in (every process whose background only is false)
                        try
                            set procName to name of proc
                            set procID to unix id of proc
                            repeat with w in (every window of proc)
                                try
                                    set windowTitle to name of w
                                    set end of windowList to ("WINDOW:" & windowTitle & ":PID:" & procID & ":END")
                                end try
                            end repeat
                        end try
                    end repeat
                    return windowList
                end tell`;
            const stdout = await this.secureExecAppleScript(script, 'getAllWindows');
            // Parse the structured output
            const windows = stdout.trim()
                .split('\n')
                .map(line => {
                const match = line.match(/WINDOW:(.*?):PID:(\d+):END/);
                if (match) {
                    const title = match[1].trim();
                    const processId = parseInt(match[2], 10);
                    // Validate each window before including
                    try {
                        this.sanitizeTitle(title);
                        this.validateProcessId(processId);
                        return { title, processId };
                    }
                    catch (error) {
                        this.securityLogger.warn('Skipping invalid window', {
                            title: title.substring(0, 50) + '...',
                            processId,
                            error: error instanceof Error ? error.message : String(error)
                        });
                        return null;
                    }
                }
                return null;
            })
                .filter((w) => w !== null);
            // Convert to WindowInfo format
            return windows.map(w => ({
                id: w.processId,
                title: w.title,
                processId: w.processId,
                bounds: { x: 0, y: 0, width: 0, height: 0 } // Bounds not available from this method
            }));
        }
        catch (error) {
            this.securityLogger.error('Error getting all windows', {
                error: error instanceof Error ? error.message : String(error)
            });
            return [];
        }
    }
    async focusWindow(windowInfo) {
        try {
            // Validate inputs
            const processId = this.validateProcessId(windowInfo.processId);
            const title = this.sanitizeTitle(windowInfo.title);
            this.securityLogger.debug('Focusing window', { processId, titleLength: title.length });
            const script = `
                tell application "System Events"
                    try
                        set targetProc to first process whose unix id is ${processId}
                        set frontmost of targetProc to true
                        
                        repeat with w in (every window of targetProc)
                            try
                                if name of w contains "${title}" then
                                    set index of w to 1
                                    return "SUCCESS"
                                end if
                            end try
                        end repeat
                        return "NOT_FOUND"
                    on error
                        return "ERROR"
                    end try
                end tell`;
            const result = await this.secureExecAppleScript(script, 'focusWindow');
            if (result.trim() === "SUCCESS") {
                // Verify focus
                const activeWindow = await this.getActiveWindow();
                const success = activeWindow?.processId === processId;
                this.securityLogger.info('Window focus attempt completed', {
                    processId,
                    success
                });
                return success;
            }
            return false;
        }
        catch (error) {
            this.securityLogger.error('Error focusing window', {
                processId: windowInfo.processId,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }
    async closeWindow(windowInfo) {
        try {
            // Validate inputs
            const processId = this.validateProcessId(windowInfo.processId);
            const title = this.sanitizeTitle(windowInfo.title);
            this.securityLogger.debug('Closing window', { processId, titleLength: title.length });
            const script = `
                tell application "System Events"
                    try
                        set targetProc to first process whose unix id is ${processId}
                        
                        repeat with w in (every window of targetProc)
                            try
                                if name of w contains "${title}" then
                                    -- Attempt to click close button (safer than arbitrary actions)
                                    click button 1 of w
                                    return "SUCCESS"
                                end if
                            end try
                        end repeat
                        return "NOT_FOUND"
                    on error
                        return "ERROR"
                    end try
                end tell`;
            const result = await this.secureExecAppleScript(script, 'closeWindow');
            const success = result.trim() === "SUCCESS";
            this.securityLogger.info('Window close attempt completed', {
                processId,
                success
            });
            return success;
        }
        catch (error) {
            this.securityLogger.error('Error closing window', {
                processId: windowInfo.processId,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }
    /**
     * Returns platform-specific API with security restrictions
     */
    getPlatformSpecificApi() {
        return {
            activeWin,
            // Provide only safe, validated execution method
            secureOsascript: {
                exec: (script, context) => this.secureExecAppleScript(script, context)
            },
            // Security information
            security: {
                maxTitleLength: this.MAX_TITLE_LENGTH,
                maxProcessId: this.MAX_PROCESS_ID,
                allowedCharacters: this.ALLOWED_CHARACTERS.source
            }
        };
    }
}
