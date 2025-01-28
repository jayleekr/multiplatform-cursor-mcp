# Windows Installation Script for Cursor MCP

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Please run this script as Administrator"
    exit 1
}

# Check Node.js installation
try {
    $nodeVersion = node -v
    Write-Host "Found Node.js version: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed. Please install Node.js v18 or higher"
    exit 1
}

# Check npm installation
try {
    $npmVersion = npm -v
    Write-Host "Found npm version: $npmVersion"
} catch {
    Write-Error "npm is not installed"
    exit 1
}

# Create necessary directories
$appDataPath = $env:LOCALAPPDATA
$cursorPath = Join-Path $appDataPath "cursor-mcp"
$configPath = Join-Path $cursorPath "config"
$logsPath = Join-Path $cursorPath "logs"

New-Item -ItemType Directory -Force -Path $cursorPath | Out-Null
New-Item -ItemType Directory -Force -Path $configPath | Out-Null
New-Item -ItemType Directory -Force -Path $logsPath | Out-Null

Write-Host "Created necessary directories"

# Install global package
try {
    npm install -g mcp-cursor
    Write-Host "Installed mcp-cursor globally"
} catch {
    Write-Error "Failed to install mcp-cursor globally: $_"
    exit 1
}

# Create startup task
$taskName = "CursorMCP"
$taskExists = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($taskExists) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute "mcp-cursor"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings
Write-Host "Created startup task"

Write-Host "Installation completed successfully!"
Write-Host "Cursor MCP will start automatically at login"
Write-Host "You can also start it manually by running 'mcp-cursor' in a terminal" 