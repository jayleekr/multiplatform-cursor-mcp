export interface WindowInfo {
    id: string | number
    title: string
    processId: number
    bounds?: {
        x: number
        y: number
        width: number
        height: number
    }
}

export interface WindowEvent {
    type: 'focus' | 'blur' | 'close' | 'move' | 'resize'
    window: WindowInfo
}

export interface WindowManager {
    // Window operations
    getActiveWindow(): Promise<WindowInfo | null>
    getAllWindows(): Promise<WindowInfo[]>
    findWindowByTitle(title: string): Promise<WindowInfo | null>
    findWindowByProcessId(processId: number): Promise<WindowInfo | null>
    
    // Window actions
    focusWindow(windowInfo: WindowInfo): Promise<boolean>
    closeWindow(windowInfo: WindowInfo): Promise<boolean>
    isWindowResponding(windowInfo: WindowInfo): Promise<boolean>
    
    // Window events
    on(event: WindowEvent['type'], callback: (event: WindowEvent) => void): void
    off(event: WindowEvent['type'], callback: (event: WindowEvent) => void): void
    
    // Input simulation
    sendKeys(windowInfo: WindowInfo, keys: string[]): Promise<void>
    sendMouseClick(x: number, y: number, button?: 'left' | 'right'): Promise<void>
    
    // Platform-specific operations
    getPlatformSpecificApi(): any // For cases where platform-specific functionality is needed
} 