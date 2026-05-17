$ErrorActionPreference = "Continue"
$projectPath = "C:\Users\User\Downloads\jarvis.html"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  INICIANDO ALMA MCP SERVER" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Carrega variáveis do .env
$envContent = Get-Content "$projectPath\.env"
foreach ($line in $envContent) {
    if ($line -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

# Inicia MCP Server
Write-Host "[MCP] Iniciando servidor MCP..." -ForegroundColor Yellow
$proc = Start-Process -FilePath "node" -ArgumentList "src/mcp_server.js" -WorkingDirectory $projectPath -PassThru -NoNewWindow

Start-Sleep -Seconds 2

if (-not $proc.HasExited) {
    Write-Host "[MCP] Servidor MCP iniciado com sucesso!" -ForegroundColor Green
    Write-Host "[MCP] PID: $($proc.Id)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "O servidor MCP está pronto para receber conexões." -ForegroundColor Cyan
    Write-Host "Pressione Ctrl+C para encerrar..." -ForegroundColor Gray

    while (-not $proc.HasExited) {
        Start-Sleep -Seconds 5
    }
} else {
    Write-Host "[MCP] Erro ao iniciar servidor!" -ForegroundColor Red
}