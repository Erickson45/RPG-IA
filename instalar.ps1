# Instalador do RPG IA (Windows 10/11). Pode rodar de novo sem problema: cada etapa verifica antes.
$ErrorActionPreference = "Stop"
$Raiz = $PSScriptRoot
Set-Location $Raiz
function Titulo($t) { Write-Host ""; Write-Host "== $t ==" -ForegroundColor Cyan }
function Ok($t) { Write-Host "  [ok] $t" -ForegroundColor Green }
function Falha($t) { Write-Host ""; Write-Host "ERRO: $t" -ForegroundColor Red; Write-Host "Consulte a seção 'Solução de problemas' do GUIA.md."; exit 1 }

Write-Host "RPG IA - instalador" -ForegroundColor White

Titulo "Python 3.12"
$py = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
if (-not (Test-Path $py)) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Falha "O winget não foi encontrado. Instale o 'Instalador de Aplicativo' pela Microsoft Store e rode de novo."
    }
    Write-Host "  instalando o Python 3.12..."
    & winget install --id Python.Python.3.12 -e --silent --scope user --accept-package-agreements --accept-source-agreements --disable-interactivity | Out-Null
}
if (-not (Test-Path $py)) { Falha "O Python 3.12 não foi instalado." }
Ok "Python 3.12"

Titulo "Bibliotecas do jogo"
if (-not (Test-Path "$Raiz\.venv\Scripts\python.exe")) { & $py -m venv "$Raiz\.venv" }
$vpy = "$Raiz\.venv\Scripts\python.exe"
& $vpy -m pip install --upgrade pip -q
& $vpy -m pip install -r "$Raiz\requirements.txt" -q
if ($LASTEXITCODE -ne 0) { Falha "Não consegui instalar as bibliotecas." }
& $vpy -c "import flask, dotenv, websockets; print('  bibliotecas ok')"
if ($LASTEXITCODE -ne 0) { Falha "As bibliotecas não carregaram." }
Ok "bibliotecas"

Titulo "Configuração"
if (-not (Test-Path "$Raiz\.env")) { Copy-Item "$Raiz\.env.example" "$Raiz\.env"; Ok ".env criado (modo roteirizado, sem custo)" } else { Ok ".env já existe" }

Write-Host ""
Write-Host "Tudo pronto!" -ForegroundColor Green
Write-Host "Dê dois cliques em iniciar.bat: o jogo abre no navegador em localhost:5050."
Write-Host "O passo a passo completo (IA de verdade, multijogador, publicar na internet) está no GUIA.md."
