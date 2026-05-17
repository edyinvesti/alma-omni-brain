$ErrorActionPreference = "SilentlyContinue"
$projectPath = "C:\Users\User\Downloads\jarvis.html"

function Start-Always {
    $proc = Start-Process -FilePath "python" -ArgumentList "jarvis\automation\hermes_server.py" -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru
    while (!$proc.HasExited) {
        Start-Sleep -Seconds 1
    }
    Write-Host "Hermes caiu, reiniciando..."
    Start-Sleep -Seconds 3
    Start-Always
}

Start-Always