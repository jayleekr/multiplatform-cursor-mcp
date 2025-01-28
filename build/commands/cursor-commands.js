import { z } from 'zod';
// Define core Cursor commands that Claude can use
export const CURSOR_COMMANDS = {
    'openCline': {
        name: 'openCline',
        description: 'Opens a new Cline AI assistant tab',
        palette_command: 'Cline: Open in New Tab'
    },
    'openExtensions': {
        name: 'openExtensions',
        description: 'Opens the extensions panel',
        palette_command: 'Extensions: Install Extensions'
    },
    'openSettings': {
        name: 'openSettings',
        description: 'Opens Cursor settings',
        palette_command: 'Preferences: Open Settings'
    },
    'openTerminal': {
        name: 'openTerminal',
        description: 'Opens a new terminal',
        palette_command: 'Terminal: Create New Terminal'
    }
};
// Schema for command execution
export const CommandSchema = z.object({
    command: z.enum(['openCline', 'openExtensions', 'openSettings', 'openTerminal']),
    args: z.record(z.any()).optional()
});
// Get the palette command for a given command name
export function getPaletteCommand(commandName) {
    const command = CURSOR_COMMANDS[commandName];
    return command ? command.palette_command : null;
}
