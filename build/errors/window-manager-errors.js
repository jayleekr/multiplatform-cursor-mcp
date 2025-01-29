export class WindowManagerError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WindowManagerError';
    }
}
export class WindowNotFoundError extends WindowManagerError {
    constructor(identifier) {
        super(`Window not found: ${identifier}`);
        this.name = 'WindowNotFoundError';
    }
}
export class WindowFocusError extends WindowManagerError {
    constructor(message) {
        super(`Failed to focus window: ${message}`);
        this.name = 'WindowFocusError';
    }
}
export class WindowCloseError extends WindowManagerError {
    constructor(message) {
        super(`Failed to close window: ${message}`);
        this.name = 'WindowCloseError';
    }
}
export class InputAutomationError extends WindowManagerError {
    constructor(message) {
        super(`Input automation failed: ${message}`);
        this.name = 'InputAutomationError';
    }
}
export class PlatformNotSupportedError extends WindowManagerError {
    constructor(platform) {
        super(`Platform not supported: ${platform}`);
        this.name = 'PlatformNotSupportedError';
    }
}
export class DependencyError extends WindowManagerError {
    constructor(dependency, platform) {
        super(`Required dependency '${dependency}' not found for platform ${platform}`);
        this.name = 'DependencyError';
    }
}
export class WindowResponseError extends WindowManagerError {
    constructor(message) {
        super(`Window not responding: ${message}`);
        this.name = 'WindowResponseError';
    }
}
export class InvalidWindowStateError extends WindowManagerError {
    constructor(message) {
        super(`Invalid window state: ${message}`);
        this.name = 'InvalidWindowStateError';
    }
}
