# ============================================
#   ALMA LOCAL MODULES STARTUP SCRIPT
#   Inicia: Voice, Vision, Memory, Automation
# ============================================

$projectPath = "C:\Users\User\Downloads\jarvis.html"
$env:PATH = "C:\Python314;C:\Python314\Scripts;$env:PATH"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  INICIANDO MÓDULOS LOCAIS - ALMA" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Função para iniciar processo em background
function Start-Module {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WorkingDir
    )

    $proc = Start-Process -FilePath "python" -ArgumentList $Command -WorkingDirectory $WorkingDir -WindowStyle Normal -PassThru
    Write-Host "[$Name] PID: $($proc.Id)" -ForegroundColor Green

    # Espera um pouco para verificar se não crashou imediatamente
    Start-Sleep -Seconds 1
    if ($proc.HasExited) {
        Write-Host "[$Name] FALHOU ao iniciar!" -ForegroundColor Red
    }
}

# Limpa processos antigos se existirem
Write-Host "[LIMPEZA] Encerrando instâncias anteriores..." -ForegroundColor Yellow
Get-Process -Name "python" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "[1/4] Iniciando ALMA CORE (Voice + Brain + Memory)..." -ForegroundColor Cyan
Start-Module -Name "ALMA_CORE" -Command "jarvis\main.py" -WorkingDir $projectPath

Write-Host ""
Write-Host "[2/4] Iniciando HERMES SERVER (Automação PC)..." -ForegroundColor Cyan
Start-Module -Name "HERMES" -Command "jarvis\automation\hermes_server.py" -WorkingDir $projectPath

Write-Host ""
Write-Host "[3/4] Módulos iniciados com sucesso!" -ForegroundColor Green
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  MÓDULOS LOCAIS ATIVOS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  - Voice Listener (microfone)" -ForegroundColor Yellow
Write-Host "  - Voice Speaker (Edge TTS)" -ForegroundColor Yellow
Write-Host "  - Brain (Groq LLM)" -ForegroundColor Yellow
Write-Host "  - Memory Manager" -ForegroundColor Yellow
Write-Host "  - Hermes Automação" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Para testar VISÃO: python jarvis\vision\test_vision.py" -ForegroundColor Gray
Write-Host "  Para ATHENA (Web): python jarvis\web_agent\agent.py" -ForegroundColor Gray
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Mantém o script vivo para monitoramento
Write-Host "Pressione Ctrl+C para encerrar todos os módulos..." -ForegroundColor Gray

while ($true) {
    Start-Sleep -Seconds 5

    # Verifica se algum processo morreu
    $processes = Get-Process -Name "python" -ErrorAction SilentlyContinue
    if (-not $processes) {
        Write-Host ""
        Write-Host "[ALERTA] Todos os processos encerrados!" -ForegroundColor Red
        break
    }
}