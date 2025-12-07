# Start bridge script - disables websocket encryption before starting
$optionsFile = "C:\Users\austi\AppData\Roaming\Minecraft Bedrock\Users\2713953862942916608\games\com.mojang\minecraftpe\options.txt"

Write-Host "Disabling Minecraft websocket encryption..." -ForegroundColor Yellow

# Read, modify, and write the options file
$content = Get-Content $optionsFile -Raw
$content = $content -replace "websocket_encryption:1", "websocket_encryption:0"
Set-Content $optionsFile $content -NoNewline

Write-Host "websocket_encryption set to 0" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Run /connect localhost:19131 in Minecraft BEFORE" -ForegroundColor Cyan
Write-Host "opening any menus or settings, as that may reset the encryption setting." -ForegroundColor Cyan
Write-Host ""

# Start the bridge
Set-Location $PSScriptRoot
node bridge.js
