$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

function Test-PortListening {
  param(
    [int]$Port
  )

  return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Start-LocalPostgres {
  $postgres = "C:\Program Files\PostgreSQL\18\bin\postgres.exe"
  $dataDir = "C:\Program Files\PostgreSQL\18\data"

  if (-not (Test-Path $postgres)) {
    Write-Host "==> PostgreSQL binary not found, skipping local DB startup"
    return
  }

  Write-Host "==> Starting local PostgreSQL process"
  Start-Process -FilePath $postgres -ArgumentList "-D `"$dataDir`" -p 5432" -WindowStyle Hidden
  Start-Sleep -Seconds 5

  if (Test-PortListening -Port 5432) {
    Write-Host "==> PostgreSQL is listening on 5432"
  } else {
    Write-Host "==> PostgreSQL could not be started automatically"
  }
}

function Start-LocalRedis {
  if (Test-PortListening -Port 6380) {
    Write-Host "==> Redis 8 is listening on 6380"
    return
  }

  $projectRoot = Split-Path -Parent $PSScriptRoot
  $redis = Join-Path $projectRoot ".tools\redis-windows-8.6.2\Redis-8.6.2-Windows-x64-cygwin-with-Service\redis-server.exe"
  $redisConf = "/cygdrive/c/Users/user/Desktop/AI-VIDIO/.tools/redis-windows-8.6.2/redis-6380.conf"

  if (-not (Test-Path $redis)) {
    Write-Host "==> Redis 8 binary not found, skipping local Redis startup"
    return
  }

  Write-Host "==> Starting local Redis 8 process"
  Start-Process -FilePath $redis -ArgumentList $redisConf -WindowStyle Hidden
  Start-Sleep -Seconds 5

  if (Test-PortListening -Port 6380) {
    Write-Host "==> Redis 8 is listening on 6380"
  } else {
    Write-Host "==> Redis could not be started automatically"
  }
}

function Open-PrivateBrowser {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  $edgePaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
  )
  $chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
  )

  foreach ($edge in $edgePaths) {
    if (Test-Path $edge) {
      Start-Process -FilePath $edge -ArgumentList "--inprivate", $Url
      return
    }
  }

  foreach ($chrome in $chromePaths) {
    if (Test-Path $chrome) {
      Start-Process -FilePath $chrome -ArgumentList "--incognito", $Url
      return
    }
  }

  Start-Process $Url
}

if (-not $env:DATABASE_URL) { $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ai_vidio?schema=public" }
if (-not $env:REDIS_URL) { $env:REDIS_URL = "redis://localhost:6380" }
if (-not $env:CORS_ORIGIN) { $env:CORS_ORIGIN = "http://localhost:3000,http://localhost:3001,http://localhost:3002" }
if (-not $env:AI_PROVIDER) { $env:AI_PROVIDER = "openai" }
if (-not $env:AI_MODEL) { $env:AI_MODEL = "gpt-5.4" }
if (-not $env:CHAT_ASSISTANT_MODEL) { $env:CHAT_ASSISTANT_MODEL = "gpt-5.4" }
if (-not $env:CHAT_ASSISTANT_TONE) { $env:CHAT_ASSISTANT_TONE = "friendly" }
if (-not $env:CHAT_CONTEXT_WINDOW) { $env:CHAT_CONTEXT_WINDOW = "8" }

Write-Host "==> Preparing local stack"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
  docker compose up -d postgres redis | Out-Host
} elseif (-not (Test-PortListening -Port 5432)) {
  Start-LocalPostgres
  Start-LocalRedis
}

Write-Host "==> Generating Prisma client"
npm run prisma:generate

Write-Host "==> Syncing Prisma schema"
npm --workspace @ai-vidio/api run db:push

Write-Host "==> Launching services"
Start-Process powershell.exe -ArgumentList "-NoExit", "-File", (Join-Path $PSScriptRoot "start-api.ps1")
Start-Process powershell.exe -ArgumentList "-NoExit", "-File", (Join-Path $PSScriptRoot "start-web.ps1")
Start-Process powershell.exe -ArgumentList "-NoExit", "-File", (Join-Path $PSScriptRoot "start-admin.ps1")

Start-Sleep -Seconds 8

Write-Host "==> Opening browser tabs"
Open-PrivateBrowser "http://localhost:3000"
Open-PrivateBrowser "http://localhost:3002"
Open-PrivateBrowser "http://localhost:3001"

Write-Host "AI-VIDIO started."
