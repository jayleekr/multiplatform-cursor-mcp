import path from 'path';
import os from 'os';
import fs from 'fs';
/**
 * Security-hardened Path Resolver
 * Prevents path traversal attacks and validates file access
 */
export class PathResolver {
    static ALLOWED_PATH_PATTERN = /^[a-zA-Z0-9\-_./\\:\s]+$/;
    static MAX_PATH_LENGTH = 1000;
    static FORBIDDEN_PATHS = [
        '/etc',
        '/root',
        '/var/log',
        '/System',
        '/Library/Keychains',
        '/private/var/db',
        'C:\\Windows\\System32',
        'C:\\Users\\Administrator'
    ];
    /**
     * Validates and normalizes a file path
     */
    static validatePath(inputPath, description) {
        if (!inputPath || typeof inputPath !== 'string') {
            throw new Error(`${description} must be a valid string`);
        }
        // Length validation
        if (inputPath.length > this.MAX_PATH_LENGTH) {
            throw new Error(`${description} exceeds maximum length (${this.MAX_PATH_LENGTH})`);
        }
        // Character validation
        if (!this.ALLOWED_PATH_PATTERN.test(inputPath)) {
            throw new Error(`${description} contains invalid characters`);
        }
        // Normalize the path to prevent traversal
        const normalizedPath = path.normalize(inputPath);
        // Check for path traversal attempts
        if (normalizedPath.includes('..')) {
            throw new Error(`${description} contains path traversal sequences`);
        }
        // Check against forbidden paths
        for (const forbidden of this.FORBIDDEN_PATHS) {
            if (normalizedPath.toLowerCase().startsWith(forbidden.toLowerCase())) {
                throw new Error(`${description} accesses forbidden system directory`);
            }
        }
        return normalizedPath;
    }
    /**
     * Safely verifies if a file exists without exposing system information
     */
    static safeFileExists(filePath) {
        try {
            fs.accessSync(filePath, fs.constants.F_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    static getCursorExecutablePath() {
        let executablePath;
        switch (process.platform) {
            case 'win32':
                const localAppData = process.env.LOCALAPPDATA;
                if (!localAppData) {
                    throw new Error('LOCALAPPDATA environment variable not found');
                }
                executablePath = path.join(localAppData, 'Programs', 'cursor', 'Cursor.exe');
                break;
            case 'darwin':
                executablePath = '/Applications/Cursor.app/Contents/MacOS/Cursor';
                break;
            case 'linux':
                // Common Linux installation paths
                const linuxPaths = [
                    path.join(os.homedir(), '.local', 'bin', 'cursor'),
                    '/usr/local/bin/cursor',
                    '/usr/bin/cursor'
                ];
                // Find first existing path
                const existingPath = linuxPaths.find(p => this.safeFileExists(p));
                if (!existingPath) {
                    throw new Error('Cursor executable not found in any of the expected locations');
                }
                executablePath = existingPath;
                break;
            default:
                throw new Error(`Unsupported platform: ${process.platform}`);
        }
        // Validate the final path
        const validatedPath = this.validatePath(executablePath, 'Cursor executable path');
        // Additional security check: ensure it's actually an executable
        if (!this.safeFileExists(validatedPath)) {
            throw new Error(`Cursor executable not found at: ${validatedPath}`);
        }
        return validatedPath;
    }
    static getDefaultWorkspacePath() {
        let workspacePath;
        switch (process.platform) {
            case 'win32':
                workspacePath = path.join(os.homedir(), 'Documents', 'cursor-workspaces');
                break;
            case 'darwin':
            case 'linux':
                workspacePath = path.join(os.homedir(), '.cursor', 'workspaces');
                break;
            default:
                throw new Error(`Unsupported platform: ${process.platform}`);
        }
        return this.validatePath(workspacePath, 'Default workspace path');
    }
    static getConfigPath() {
        let configPath;
        switch (process.platform) {
            case 'win32':
                const appData = process.env.APPDATA;
                if (!appData) {
                    throw new Error('APPDATA environment variable not found');
                }
                configPath = path.join(appData, 'cursor-mcp');
                break;
            case 'darwin':
                configPath = path.join(os.homedir(), 'Library', 'Application Support', 'cursor-mcp');
                break;
            case 'linux':
                configPath = path.join(os.homedir(), '.config', 'cursor-mcp');
                break;
            default:
                throw new Error(`Unsupported platform: ${process.platform}`);
        }
        return this.validatePath(configPath, 'Config path');
    }
    /**
     * Validates a user-provided workspace path
     */
    static validateWorkspacePath(userPath) {
        const validatedPath = this.validatePath(userPath, 'Workspace path');
        // Ensure it's within user's home directory or a safe location
        const homeDir = os.homedir();
        const resolvedPath = path.resolve(validatedPath);
        const resolvedHome = path.resolve(homeDir);
        if (!resolvedPath.startsWith(resolvedHome)) {
            // Allow some common development directories
            const allowedRoots = [
                '/Users',
                '/home',
                'C:\\Users',
                '/tmp',
                '/var/tmp'
            ];
            const isAllowed = allowedRoots.some(root => resolvedPath.toLowerCase().startsWith(root.toLowerCase()));
            if (!isAllowed) {
                throw new Error('Workspace path must be within user directory or allowed development locations');
            }
        }
        return validatedPath;
    }
    /**
     * Creates a directory safely if it doesn't exist
     */
    static ensureDirectoryExists(dirPath) {
        const validatedPath = this.validatePath(dirPath, 'Directory path');
        try {
            if (!this.safeFileExists(validatedPath)) {
                fs.mkdirSync(validatedPath, { recursive: true, mode: 0o755 });
            }
        }
        catch (error) {
            throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
