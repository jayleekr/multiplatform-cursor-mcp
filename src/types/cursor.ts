import { ChildProcess } from 'child_process'
import { WindowInfo } from '../services/window-manager/types.js'

// Alias the node-window-manager Window type
export type Window = WindowInfo

export interface CursorInstance {
    id: string               // UUID of the instance
    process: ChildProcess    // Reference to the spawned process
    window?: WindowInfo      // Window information from our platform-agnostic window manager
    workspacePath?: string   // Optional workspace path this instance was opened with
    createdAt: Date         // When this instance was created
    isActive: boolean       // Whether this instance is still running
}

export interface CursorInstanceManager {
    create(workspacePath?: string): Promise<CursorInstance>
    get(id: string): CursorInstance | undefined
    list(): CursorInstance[]
    remove(id: string): boolean
    sendKeyToInstance(id: string, keys: string[]): Promise<void>
    openCommandPalette(id: string): Promise<void>
    openClineTab(id: string): Promise<void>
} 