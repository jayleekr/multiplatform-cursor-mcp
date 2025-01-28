import { McpError } from '@modelcontextprotocol/sdk/types.js';
export class CursorToolHandler {
    cursorManager;
    constructor(cursorManager) {
        this.cursorManager = cursorManager;
    }
    async handleOpenCursor(params, chainContext) {
        try {
            const instance = await this.cursorManager.create(params.workspacePath);
            const response = {
                instanceId: instance.id,
                status: "success"
            };
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(response)
                    }],
                chainContext: {
                    instanceId: instance.id,
                    toolName: "open_cursor"
                }
            };
        }
        catch (error) {
            throw new McpError(500, `Failed to launch Cursor: ${error?.message || 'Unknown error'}`);
        }
    }
    async handleCursorCommand(params, chainContext) {
        try {
            const instanceId = params.instanceId || chainContext?.instanceId;
            if (!instanceId) {
                throw new McpError(400, "Instance ID is required");
            }
            const { command } = params;
            await this.cursorManager.openCommandPalette(instanceId);
            await new Promise(resolve => setTimeout(resolve, 500));
            const response = {
                status: "success",
                command: command,
                result: "Command executed successfully"
            };
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(response)
                    }],
                chainContext: {
                    instanceId,
                    toolName: "cursor_command",
                    lastCommand: command
                }
            };
        }
        catch (error) {
            throw new McpError(500, `Failed to execute command: ${error?.message || 'Unknown error'}`);
        }
    }
    async handleOpenClineTab(params, chainContext) {
        try {
            const instanceId = params.instanceId || chainContext?.instanceId;
            if (!instanceId) {
                throw new McpError(400, "Instance ID is required");
            }
            await this.cursorManager.openClineTab(instanceId);
            const response = {
                status: "success",
                instanceId: instanceId,
                tabId: `cline-${Date.now()}`
            };
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(response)
                    }],
                chainContext: {
                    instanceId,
                    toolName: "open_cline_tab",
                    tabId: response.tabId
                }
            };
        }
        catch (error) {
            throw new McpError(500, `Failed to open Cline tab: ${error?.message || 'Unknown error'}`);
        }
    }
}
