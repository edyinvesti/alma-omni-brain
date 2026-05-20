$ErrorActionPreference = "Continue"
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   INICIANDO A.L.M.A. MODO HÍBRIDO (TÚNEL)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Parando Hermes antigo se estiver rodando
$porta = 3001
$processos = Get-NetTCPConnection -LocalPort $porta -ErrorAction SilentlyContinue
foreach ($proc in $processos) {
    if ($proc.State -eq "Listen") {
        Stop-Process -Id $proc.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "[-] Porta $porta limpa." -ForegroundColor Yellow
    }
}

# Iniciando o servidor Hermes local em background
Write-Host "[+] Ligando módulo robótico Hermes..." -ForegroundColor Green
Start-Process -FilePath "python" -ArgumentList "alma\automation\hermes_server.py" -WindowStyle Hidden
Start-Process -FilePath "python" -ArgumentList "obsidian_watcher.py" -WindowStyle Hidden

Start-Sleep -Seconds 3

# Iniciando túnel para a nuvem
Write-Host "[+] Abrindo Buraco de Minhoca para o Render.com..." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Copie o link verde que vai aparecer abaixo" 
Write-Host "e cole na sua variável HERMES_URL lá no Render:" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan

# O localtunnel criará a URL pública e mostrará na tela
npx localtunnel --port 3001
