export class WindowManagerError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WindowManagerError'
    }
}

export class WindowNotFoundError extends WindowManagerError {
    constructor(identifier: string | number) {
        super(`Window not found: ${identifier}`)
        this.name = 'WindowNotFoundError'
    }
}

export class WindowFocusError extends WindowManagerError {
    constructor(message: string) {
        super(`Failed to focus window: ${message}`)
        this.name = 'WindowFocusError'
    }
}

export class WindowCloseError extends WindowManagerError {
    constructor(message: string) {
        super(`Failed to close window: ${message}`)
        this.name = 'WindowCloseError'
    }
}

export class InputAutomationError extends WindowManagerError {
    constructor(message: string) {
        super(`Input automation failed: ${message}`)
        this.name = 'InputAutomationError'
    }
}

export class PlatformNotSupportedError extends WindowManagerError {
    constructor(platform: string) {
        super(`Platform not supported: ${platform}`)
        this.name = 'PlatformNotSupportedError'
    }
}

export class DependencyError extends WindowManagerError {
    constructor(dependency: string, platform: string) {
        super(`Required dependency '${dependency}' not found for platform ${platform}`)
        this.name = 'DependencyError'
    }
}

export class WindowResponseError extends WindowManagerError {
    constructor(message: string) {
        super(`Window not responding: ${message}`)
        this.name = 'WindowResponseError'
    }
}

export class InvalidWindowStateError extends WindowManagerError {
    constructor(message: string) {
        super(`Invalid window state: ${message}`)
        this.name = 'InvalidWindowStateError'
    }
} 