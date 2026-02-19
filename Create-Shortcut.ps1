
$desktop = [Environment]::GetFolderPath("Desktop")
$target = "$PSScriptRoot\dist\win-unpacked\GNS Quiz Manager.exe"
$icon = "$PSScriptRoot\assets\icon.ico"
$shortcutPath = "$desktop\GNS Quiz Manager.lnk"

if (-not (Test-Path $target)) {
    Write-Host "Error: Unpacked EXE not found at $target" -ForegroundColor Red
    $target = "$PSScriptRoot\dist\GNS-Quiz-Manager-Portable.exe"
    if (-not (Test-Path $target)) {
         Write-Host "Error: Portable EXE also not found." -ForegroundColor Red
         exit
    }
}

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $target
$Shortcut.IconLocation = $icon
$Shortcut.WorkingDirectory = Split-Path $target
$Shortcut.Save()

Write-Host "Shortcut created on Desktop: $shortcutPath" -ForegroundColor Green
Write-Host "Please use this shortcut to launch the app."
