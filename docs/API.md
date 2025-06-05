# API Documentation

## Window Management API

### WindowManager Interface

```typescript
interface WindowManager {
  findWindows(criteria: WindowCriteria): Promise<WindowInfo[]>;
  activateWindow(window: WindowInfo): Promise<void>;
  moveWindow(window: WindowInfo, x: number, y: number): Promise<void>;
  resizeWindow(window: WindowInfo, width: number, height: number): Promise<void>;
  closeWindow(window: WindowInfo): Promise<void>;
}
```

### Platform-Specific Implementations

#### Windows Manager
- Uses native Windows APIs through active-win
- Supports window title, process name, and PID-based searching
- Full window manipulation capabilities

#### macOS Manager  
- Utilizes AppleScript for window operations
- Requires accessibility permissions
- Supports application-based window management

#### Linux Manager
- Uses xdotool for X11 window management
- Requires xdotool installation
- Supports EWMH-compliant window managers

## Input Automation API

### InputService Interface

```typescript
interface InputService {
  sendKeySequence(keys: string[]): Promise<void>;
  sendText(text: string): Promise<void>;
  click(x: number, y: number): Promise<void>;
  doubleClick(x: number, y: number): Promise<void>;
  rightClick(x: number, y: number): Promise<void>;
  scrollUp(lines?: number): Promise<void>;
  scrollDown(lines?: number): Promise<void>;
  dragAndDrop(fromX: number, fromY: number, toX: number, toY: number): Promise<void>;
}
```

### Supported Key Combinations

- Standard keys: `a-z`, `A-Z`, `0-9`
- Modifier keys: `cmd`, `ctrl`, `alt`, `shift`  
- Special keys: `space`, `enter`, `tab`, `escape`, `backspace`, `delete`
- Function keys: `f1`-`f12`
- Arrow keys: `up`, `down`, `left`, `right`

## Cursor Instance Management

### CursorInstanceManager

```typescript
class CursorInstanceManager {
  async ensureCursorRunning(): Promise<boolean>;
  async findCursorWindows(): Promise<WindowInfo[]>;
  async openCursorWithFile(filePath: string): Promise<void>;
  async sendCommandToCursor(command: string): Promise<void>;
}
```

## Error Handling

All API methods return Promises that may reject with structured errors:

```typescript
interface AutomationError extends Error {
  code: string;
  platform?: string;
  context?: Record<string, unknown>;
}
```

### Common Error Codes

- `WINDOW_NOT_FOUND`: Target window could not be located
- `PERMISSION_DENIED`: Insufficient permissions for automation
- `PLATFORM_NOT_SUPPORTED`: Feature not available on current platform
- `AUTOMATION_FAILED`: General automation operation failure
- `INVALID_COORDINATES`: Invalid screen coordinates provided
- `PROCESS_NOT_FOUND`: Target process is not running

## Platform Requirements

### Windows
- Windows 10 or later
- Node.js 18+
- Administrative privileges for some operations

### macOS  
- macOS 10.14 or later
- Accessibility permissions required
- Xcode Command Line Tools

### Linux
- X11 display server
- xdotool package
- Node.js 18+
- udev rules for input devices

## Usage Examples

### Basic Window Management

```typescript
import { WindowManagerFactory } from './services/window-manager/factory';

const windowManager = WindowManagerFactory.create();

// Find all Cursor windows
const windows = await windowManager.findWindows({
  processName: 'Cursor'
});

// Activate the first window
if (windows.length > 0) {
  await windowManager.activateWindow(windows[0]);
}
```

### Input Automation

```typescript
import { InputService } from './services/input-automation/input-service';

const inputService = new InputService();

// Send keyboard shortcut
await inputService.sendKeySequence(['cmd', 'k']);

// Type text
await inputService.sendText('Hello, World!');

// Click at coordinates
await inputService.click(100, 200);
```

### Cursor Integration

```typescript
import { CursorInstanceManager } from './managers/CursorInstanceManager';

const cursorManager = new CursorInstanceManager();

// Ensure Cursor is running
await cursorManager.ensureCursorRunning();

// Open a file in Cursor
await cursorManager.openCursorWithFile('/path/to/file.ts');

// Send command palette command
await cursorManager.sendCommandToCursor('Developer: Reload Window');
``` 