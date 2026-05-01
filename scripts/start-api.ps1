$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)
$env:PORT = "3001"
npm run dev:api
