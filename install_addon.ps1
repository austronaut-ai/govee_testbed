$ErrorActionPreference = "Stop"

$ErrorActionPreference = "Stop"

$SourcePath = Join-Path $PSScriptRoot "minecraft-addon"
# $BaseDestPath = "C:\Users\austi\AppData\Roaming\Minecraft Bedrock\Users\Shared\games\com.mojang\development_behavior_packs"
$BaseDestPath = "$env:LOCALAPPDATA\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs"
$DestPath = Join-Path $BaseDestPath "GoveeControllerV3"

Write-Host "Installing Govee Addon V3 to: $DestPath"

# Ensure development_behavior_packs exists
if (-not (Test-Path $BaseDestPath)) {
    Write-Host "Creating directory: $BaseDestPath"
    New-Item -ItemType Directory -Force -Path $BaseDestPath | Out-Null
}

# Clean old install aggressively
if (Test-Path $DestPath) {
    Write-Host "Removing old V3 installation..."
    Remove-Item -Recurse -Force $DestPath
}

# Copy new files
Write-Host "Copying V3 files..."
Copy-Item -Recurse -Force $SourcePath $DestPath

Write-Host "Success! Addon V3 installed."
Write-Host "1. Restart Minecraft completely."
Write-Host "2. Enable 'Govee Controller V3' behavior pack."
Write-Host "3. Ensure 'Beta APIs' is enabled."
Start-Sleep -Seconds 5
