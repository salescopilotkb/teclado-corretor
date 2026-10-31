# Monta os dois pacotes para o HostGator (rodar na raiz do projeto, no PowerShell):
#   powershell -ExecutionPolicy Bypass -File scripts/build_hostgator_zips.ps1
#
#   keyconapp-public_html.zip  → public_html de keyconapp.com (landing + app de demonstração em /app)
#   locker-public_html.zip     → pasta do subdomínio locker.keyconapp.com (Locker web)
#
# Os zips usam "/" nos caminhos (o Compress-Archive do Windows grava "\", e o
# extrator do cPanel pode criar arquivos chamados "assets\x.js" em vez de pastas).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Write-Zip([string]$Source, [string]$Target) {
  $src = (Resolve-Path $Source).Path
  if (Test-Path $Target) { Remove-Item $Target -Confirm:$false }
  $zip = [IO.Compression.ZipFile]::Open((Join-Path $PWD $Target), 'Create')
  try {
    Get-ChildItem -Force -Recurse -File $src | ForEach-Object {
      $rel = $_.FullName.Substring($src.Length + 1).Replace('\', '/')
      [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, 'Optimal')
    }
  } finally {
    $zip.Dispose()
  }
  Write-Output "$Target pronto ($((Get-Item $Target).Length) bytes)"
}

# 1. Site + app de demonstração
npm run -s web:build
if ($LASTEXITCODE) { throw 'web:build falhou' }
if (Test-Path hostgator) { Remove-Item -Recurse -Force hostgator -Confirm:$false }
New-Item -ItemType Directory hostgator | Out-Null
Get-ChildItem landing | Where-Object { $_.Name -ne 'three.min.js' } | ForEach-Object { Copy-Item -Recurse -LiteralPath $_.FullName -Destination hostgator }
Copy-Item -Recurse -LiteralPath dist -Destination hostgator\app
Write-Zip hostgator keyconapp-public_html.zip

# 2. Locker web
npm run -s locker:build
if ($LASTEXITCODE) { throw 'locker:build falhou' }
Write-Zip dist-locker locker-public_html.zip
