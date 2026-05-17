$ErrorActionPreference = "Continue"
$projectPath = "C:\Users\User\Downloads\jarvis.html"

function Start-Hermes-Always {
    $running = $true

    while ($running) {
        Write-Host "[HERMES] Iniciando daemon..."

        $proc = Start-Process -FilePath "py" -ArgumentList "-3.13", "jarvis\automation\hermes_server.py" -WorkingDirectory $projectPath -PassThru

        Write-Host "[HERMES] PID: $($proc.Id) - Aguardando inicialização..."
        Start-Sleep -Seconds 3

        # Testa se está responding
        try {
            $test = Invoke-WebRequest -Uri "http://localhost:3001/api/hermes/status" -UseBasicParsing -TimeoutSec 5
            if ($test.StatusCode -eq 200) {
                Write-Host "[HERMES] ONLINE! - Pressione Ctrl+C para encerrar" -ForegroundColor Green

                # Mantém monitorando
                while (!$proc.HasExited) {
                    Start-Sleep -Seconds 10
                }
            }
        } catch {
            Write-Host "[HERMES] Erro ao iniciar, tentando novamente..." -ForegroundColor Yellow
        }

        if ($proc.HasExited) {
            Write-Host "[HERMES] Processo encerrou, reiniciando em 3s..." -ForegroundColor Red
            Start-Sleep -Seconds 3
        }
    }
}

Start-Hermes-Always