import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PathResolver } from '../utils/path-resolver.js';
import path from 'path';
import os from 'os';
describe('Path Resolver Tests', () => {
    describe('Cursor Executable Path', () => {
        it('should return platform-specific Cursor executable path', () => {
            const execPath = PathResolver.getCursorExecutablePath();
            switch (process.platform) {
                case 'win32':
                    assert(execPath.endsWith('Cursor.exe'));
                    assert(execPath.includes('Programs'));
                    break;
                case 'darwin':
                    assert.strictEqual(execPath, '/Applications/Cursor.app/Contents/MacOS/Cursor');
                    break;
                case 'linux':
                    assert(execPath.includes('/.local/bin/cursor') ||
                        execPath.includes('/usr/local/bin/cursor') ||
                        execPath.includes('/usr/bin/cursor'));
                    break;
                default:
                    assert.fail(`Unsupported platform: ${process.platform}`);
            }
        });
        it('should handle missing LOCALAPPDATA on Windows', function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            const oldLocalAppData = process.env.LOCALAPPDATA;
            delete process.env.LOCALAPPDATA;
            try {
                const execPath = PathResolver.getCursorExecutablePath();
                assert(execPath.endsWith('Cursor.exe'));
                assert(execPath.includes('Programs'));
            }
            finally {
                process.env.LOCALAPPDATA = oldLocalAppData;
            }
        });
    });
    describe('Default Workspace Path', () => {
        it('should return platform-specific workspace path', () => {
            const workspacePath = PathResolver.getDefaultWorkspacePath();
            switch (process.platform) {
                case 'win32':
                    assert(workspacePath.includes('Documents'));
                    assert(workspacePath.endsWith('cursor-workspaces'));
                    break;
                case 'darwin':
                case 'linux':
                    assert(workspacePath.startsWith(os.homedir()));
                    assert(workspacePath.includes('.cursor'));
                    assert(workspacePath.endsWith('workspaces'));
                    break;
                default:
                    assert.fail(`Unsupported platform: ${process.platform}`);
            }
        });
        it('should use correct path separators', () => {
            const workspacePath = PathResolver.getDefaultWorkspacePath();
            const normalizedPath = path.normalize(workspacePath);
            assert.strictEqual(workspacePath, normalizedPath);
        });
    });
    describe('Config Path', () => {
        it('should return platform-specific config path', () => {
            const configPath = PathResolver.getConfigPath();
            switch (process.platform) {
                case 'win32':
                    assert(configPath.includes('AppData'));
                    assert(configPath.endsWith('cursor-mcp'));
                    break;
                case 'darwin':
                    assert(configPath.includes('Library/Application Support'));
                    assert(configPath.endsWith('cursor-mcp'));
                    break;
                case 'linux':
                    assert(configPath.includes('.config'));
                    assert(configPath.endsWith('cursor-mcp'));
                    break;
                default:
                    assert.fail(`Unsupported platform: ${process.platform}`);
            }
        });
        it('should handle missing APPDATA on Windows', function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            const oldAppData = process.env.APPDATA;
            delete process.env.APPDATA;
            try {
                const configPath = PathResolver.getConfigPath();
                assert(configPath.endsWith('cursor-mcp'));
            }
            finally {
                process.env.APPDATA = oldAppData;
            }
        });
    });
});
