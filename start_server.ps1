$ErrorActionPreference = "SilentlyContinue"
$projectPath = "C:\Users\User\Downloads\jarvis.html"

function Start-Always {
    $proc = Start-Process -FilePath "node" -ArgumentList "src/server.js" -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru
    while (!$proc.HasExited) {
        Start-Sleep -Seconds 1
    }
    Write-Host "Servidor caiu, reiniciando..."
    Start-Sleep -Seconds 3
    Start-Always
}

Start-Always