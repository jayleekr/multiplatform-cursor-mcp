#!/bin/bash

# macOS Installation Script for Cursor MCP

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script with sudo"
    exit 1
fi

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js v18 or higher"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "Found Node.js version: $NODE_VERSION"

# Check npm installation
if ! command -v npm &> /dev/null; then
    echo "npm is not installed"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "Found npm version: $NPM_VERSION"

# Check Xcode Command Line Tools
if ! command -v xcode-select &> /dev/null; then
    echo "Installing Xcode Command Line Tools..."
    xcode-select --install
    echo "Please complete the Xcode Command Line Tools installation and run this script again"
    exit 1
fi

# Create necessary directories
CURSOR_HOME="$HOME/.cursor"
CONFIG_DIR="$CURSOR_HOME/config"
LOGS_DIR="$CURSOR_HOME/logs"

mkdir -p "$CONFIG_DIR"
mkdir -p "$LOGS_DIR"

echo "Created necessary directories"

# Install global package
if ! npm install -g mcp-cursor; then
    echo "Failed to install mcp-cursor globally"
    exit 1
fi

echo "Installed mcp-cursor globally"

# Create launch agent
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
LAUNCH_AGENT_FILE="$LAUNCH_AGENT_DIR/com.cursor.mcp.plist"

mkdir -p "$LAUNCH_AGENT_DIR"

cat > "$LAUNCH_AGENT_FILE" << EOL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cursor.mcp</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which node)</string>
        <string>$(which mcp-cursor)</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOGS_DIR/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$LOGS_DIR/stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOL

# Set correct permissions
chown "$SUDO_USER" "$LAUNCH_AGENT_FILE"
chmod 644 "$LAUNCH_AGENT_FILE"

# Load launch agent
sudo -u "$SUDO_USER" launchctl load "$LAUNCH_AGENT_FILE"

echo "Created and loaded launch agent"

# Request accessibility permissions
echo "Please grant accessibility permissions to Terminal in:"
echo "System Preferences > Security & Privacy > Privacy > Accessibility"
echo "This is required for window management and input automation"

# Open Security & Privacy preferences
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"

echo "Installation completed successfully!"
echo "Cursor MCP will start automatically at login"
echo "You can also start it manually by running 'mcp-cursor' in a terminal" 