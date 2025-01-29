import * as activeWin from 'active-win';
import { EventEmitter } from 'events';
import { InputAutomationService } from '../input-automation/input-service.js';
import { WindowManagerError, WindowNotFoundError, WindowFocusError, WindowResponseError, InputAutomationError } from '../../errors/window-manager-errors.js';
import { log } from '../../utils/logger.js';
export class BaseWindowManager {
    eventEmitter = new EventEmitter();
    windowCache = new Map();
    inputService;
    logger = log.child('WindowManager');
    constructor() {
        this.inputService = InputAutomationService.getInstance();
        this.logger.info('Window manager initialized', { platform: process.platform });
    }
    convertToWindowInfo(activeWindow) {
        const cached = this.windowCache.get(activeWindow.owner.processId);
        if (cached) {
            this.logger.debug('Using cached window info', {
                processId: activeWindow.owner.processId
            });
            return cached;
        }
        const windowInfo = {
            id: activeWindow.owner.processId,
            title: activeWindow.title,
            processId: activeWindow.owner.processId,
            bounds: {
                x: activeWindow.bounds.x,
                y: activeWindow.bounds.y,
                width: activeWindow.bounds.width,
                height: activeWindow.bounds.height
            }
        };
        this.windowCache.set(activeWindow.owner.processId, windowInfo);
        this.logger.debug('Created new window info', { windowInfo });
        return windowInfo;
    }
    async getActiveWindow() {
        try {
            const window = await activeWin.activeWindow();
            if (!window) {
                this.logger.debug('No active window found');
                return null;
            }
            return this.convertToWindowInfo(window);
        }
        catch (error) {
            this.logger.error('Error getting active window', {
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }
    async findWindowByTitle(title) {
        this.logger.debug('Finding window by title', { title });
        const windows = await this.getAllWindows();
        const window = windows.find(w => w.title.includes(title));
        if (!window) {
            this.logger.debug('Window not found by title', { title });
            throw new WindowNotFoundError(title);
        }
        return window;
    }
    async findWindowByProcessId(processId) {
        this.logger.debug('Finding window by process ID', { processId });
        const windows = await this.getAllWindows();
        const window = windows.find(w => w.processId === processId);
        if (!window) {
            this.logger.debug('Window not found by process ID', { processId });
            throw new WindowNotFoundError(processId);
        }
        return window;
    }
    async isWindowResponding(windowInfo) {
        try {
            const window = await this.findWindowByProcessId(windowInfo.processId);
            if (!window) {
                throw new WindowResponseError('Window not found');
            }
            return true;
        }
        catch (error) {
            if (error instanceof WindowManagerError) {
                this.logger.warn('Window not responding', {
                    processId: windowInfo.processId,
                    error: error.message
                });
                return false;
            }
            throw error;
        }
    }
    on(event, callback) {
        this.logger.debug('Adding event listener', { event });
        this.eventEmitter.on(event, callback);
    }
    off(event, callback) {
        this.logger.debug('Removing event listener', { event });
        this.eventEmitter.off(event, callback);
    }
    async sendKeys(windowInfo, keys) {
        try {
            this.logger.debug('Sending keys to window', {
                processId: windowInfo.processId,
                keys
            });
            const focused = await this.focusWindow(windowInfo);
            if (!focused) {
                throw new WindowFocusError('Failed to focus window before sending keys');
            }
            await this.inputService.sendKeys(keys);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Error sending keys', {
                processId: windowInfo.processId,
                keys,
                error: errorMessage
            });
            throw new InputAutomationError(`Failed to send keys: ${errorMessage}`);
        }
    }
    async sendMouseClick(x, y, button = 'left') {
        try {
            this.logger.debug('Sending mouse click', { x, y, button });
            await this.inputService.moveMouse(x, y);
            await this.inputService.mouseClick(button);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Error sending mouse click', { x, y, button, error: errorMessage });
            throw new InputAutomationError(`Failed to send mouse click: ${errorMessage}`);
        }
    }
}
