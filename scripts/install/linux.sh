#!/bin/bash

# Linux Installation Script for Cursor MCP

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script with sudo"
    exit 1
fi

# Detect package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt-get"
    PKG_UPDATE="apt-get update"
    PKG_INSTALL="apt-get install -y"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    PKG_UPDATE="dnf check-update"
    PKG_INSTALL="dnf install -y"
elif command -v pacman &> /dev/null; then
    PKG_MANAGER="pacman"
    PKG_UPDATE="pacman -Sy"
    PKG_INSTALL="pacman -S --noconfirm"
else
    echo "Unsupported package manager. Please install dependencies manually:"
    echo "- xdotool"
    echo "- libxtst-dev"
    echo "- libpng++-dev"
    echo "- build-essential"
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

# Update package lists
echo "Updating package lists..."
$PKG_UPDATE

# Install dependencies
echo "Installing dependencies..."
case $PKG_MANAGER in
    "apt-get")
        $PKG_INSTALL xdotool libxtst-dev libpng++-dev build-essential
        ;;
    "dnf")
        $PKG_INSTALL xdotool libXtst-devel libpng-devel gcc-c++ make
        ;;
    "pacman")
        $PKG_INSTALL xdotool libxtst libpng base-devel
        ;;
esac

# Check X11
if [ -z "$DISPLAY" ]; then
    echo "X11 display not found. Please ensure X11 is running"
    exit 1
fi

# Create necessary directories
CURSOR_HOME="$HOME/.cursor"
CONFIG_DIR="$CURSOR_HOME/config"
LOGS_DIR="$CURSOR_HOME/logs"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"

mkdir -p "$CONFIG_DIR"
mkdir -p "$LOGS_DIR"
mkdir -p "$SYSTEMD_USER_DIR"

echo "Created necessary directories"

# Install global package
if ! npm install -g mcp-cursor; then
    echo "Failed to install mcp-cursor globally"
    exit 1
fi

echo "Installed mcp-cursor globally"

# Create systemd user service
SERVICE_FILE="$SYSTEMD_USER_DIR/cursor-mcp.service"

cat > "$SERVICE_FILE" << EOL
[Unit]
Description=Cursor MCP Service
After=graphical-session.target

[Service]
ExecStart=$(which mcp-cursor)
Restart=always
Environment=DISPLAY=:0

[Install]
WantedBy=graphical-session.target
EOL

# Set correct permissions
chown "$SUDO_USER" "$SERVICE_FILE"
chmod 644 "$SERVICE_FILE"

# Enable and start service
sudo -u "$SUDO_USER" systemctl --user daemon-reload
sudo -u "$SUDO_USER" systemctl --user enable cursor-mcp
sudo -u "$SUDO_USER" systemctl --user start cursor-mcp

echo "Created and started systemd service"

# Set up udev rules for input devices
UDEV_RULES_FILE="/etc/udev/rules.d/99-cursor-mcp.rules"

cat > "$UDEV_RULES_FILE" << EOL
KERNEL=="uinput", SUBSYSTEM=="misc", MODE="0660", GROUP="input"
KERNEL=="event*", SUBSYSTEM=="input", MODE="0660", GROUP="input"
EOL

# Add user to input group
usermod -a -G input "$SUDO_USER"

# Reload udev rules
udevadm control --reload-rules
udevadm trigger

echo "Set up udev rules for input devices"

echo "Installation completed successfully!"
echo "Cursor MCP will start automatically at login"
echo "You can also start it manually by running 'mcp-cursor' in a terminal"
echo "Please log out and back in for the input device permissions to take effect" 