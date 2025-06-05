import { BaseWindowManager } from './base-manager.js';
import * as activeWin from 'active-win';
import { WindowFocusError } from '../../errors/window-manager-errors.js';
export class WindowsWindowManager extends BaseWindowManager {
    async getAllWindows() {
        try {
            // Note: active-win only provides the active window
            // For a full list, we would need platform-specific APIs
            const activeWindow = await activeWin.activeWindow();
            if (!activeWindow) {
                return [];
            }
            return [this.convertToWindowInfo(activeWindow)];
        }
        catch (error) {
            this.logger.error('Error getting all windows', {
                error: error instanceof Error ? error.message : String(error)
            });
            return [];
        }
    }
    async focusWindow(windowInfo) {
        try {
            this.logger.debug('Focusing window', { processId: windowInfo.processId });
            // On Windows, we can use the input automation service to focus
            // by clicking on the window or using Alt+Tab
            const currentWindow = await activeWin.activeWindow();
            if (currentWindow && currentWindow.owner.processId === windowInfo.processId) {
                this.logger.debug('Window already focused');
                return true;
            }
            // Try to focus by sending Alt+Tab until we find our window
            let attempts = 0;
            const maxAttempts = 10;
            while (attempts < maxAttempts) {
                await this.inputService.sendKeys(['alt', 'tab']);
                await new Promise(resolve => setTimeout(resolve, 200));
                const focusedWindow = await activeWin.activeWindow();
                if (focusedWindow && focusedWindow.owner.processId === windowInfo.processId) {
                    this.logger.debug('Successfully focused window', { attempts: attempts + 1 });
                    return true;
                }
                attempts++;
            }
            this.logger.warn('Failed to focus window after maximum attempts', {
                processId: windowInfo.processId,
                attempts: maxAttempts
            });
            throw new WindowFocusError('Failed to focus window');
        }
        catch (error) {
            this.logger.error('Error focusing window', {
                processId: windowInfo.processId,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }
    async closeWindow(windowInfo) {
        try {
            this.logger.debug('Closing window', { processId: windowInfo.processId });
            // Focus the window first
            const focused = await this.focusWindow(windowInfo);
            if (!focused) {
                throw new WindowFocusError('Failed to focus window before closing');
            }
            // Send Alt+F4 to close the window
            await this.inputService.sendKeys(['alt', 'f4']);
            // Wait for window to close
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Verify window is closed
            const currentWindow = await activeWin.activeWindow();
            const isStillActive = currentWindow && currentWindow.owner.processId === windowInfo.processId;
            if (isStillActive) {
                this.logger.warn('Window may not have closed properly', {
                    processId: windowInfo.processId
                });
                return false;
            }
            this.logger.debug('Window closed successfully', { processId: windowInfo.processId });
            return true;
        }
        catch (error) {
            this.logger.error('Error closing window', {
                processId: windowInfo.processId,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }
    getPlatformSpecificApi() {
        // Return active-win for Windows platform
        return activeWin;
    }
}
