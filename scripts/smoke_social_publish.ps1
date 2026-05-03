param(
  [Parameter(Mandatory = $true)]
  [string]$ApiBaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$AuthToken,

  [Parameter(Mandatory = $true)]
  [string]$TenantId,

  [Parameter(Mandatory = $true)]
  [string]$AnalysisId,

  [Parameter(Mandatory = $true)]
  [string]$AdapterId,

  [string]$Caption = "AI-VIDIO smoke test publish",
  [int]$TargetDurationSeconds = 15,
  [int]$PollAttempts = 20,
  [int]$PollSeconds = 5
)

$ErrorActionPreference = "Stop"

function Invoke-ApiJson {
  param(
    [Parameter(Mandatory = $true)] [string]$Method,
    [Parameter(Mandatory = $true)] [string]$Url,
    [object]$Body = $null
  )

  $headers = @{
    Authorization = "Bearer $AuthToken"
  }

  if ($null -ne $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10)
  }

  return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers
}

$base = $ApiBaseUrl.TrimEnd("/")

Write-Host "[1/5] Health check..." -ForegroundColor Cyan
$health = Invoke-RestMethod -Method Get -Uri "$base/health"
$health | ConvertTo-Json -Depth 10 | Write-Host

Write-Host "[2/5] Generate video..." -ForegroundColor Cyan
$generateBody = @{
  tenantId = $TenantId
  analysisId = $AnalysisId
  targetDurationSeconds = $TargetDurationSeconds
}

$generated = Invoke-ApiJson -Method Post -Url "$base/generate-video" -Body $generateBody
$generated | ConvertTo-Json -Depth 10 | Write-Host
$projectId = $generated.projectId

if (-not $projectId) {
  throw "Video generation did not return projectId."
}

Write-Host "[3/5] Poll video status..." -ForegroundColor Cyan
$video = $null
for ($attempt = 1; $attempt -le $PollAttempts; $attempt++) {
  $video = Invoke-ApiJson -Method Get -Url "$base/video/$projectId"
  Write-Host "Attempt $attempt => status: $($video.status)"
  if ($video.status -eq "READY" -and $video.output -and $video.output.publicUrl) {
    break
  }
  Start-Sleep -Seconds $PollSeconds
}

if (-not $video -or $video.status -ne "READY") {
  throw "Video project did not reach READY within polling window."
}

$publicUrl = [string]$video.output.publicUrl
if (-not $publicUrl.StartsWith("https://")) {
  throw "Video publicUrl is not HTTPS: $publicUrl"
}

Write-Host "[4/5] Create social publish job..." -ForegroundColor Cyan
$publishBody = @{
  tenantId = $TenantId
  platform = "FACEBOOK_PAGE"
  adapterId = $AdapterId
  caption = $Caption
  mediaUrl = $publicUrl
}

$publishJob = Invoke-ApiJson -Method Post -Url "$base/api/videos/$projectId/publish/social" -Body $publishBody
$publishJob | ConvertTo-Json -Depth 10 | Write-Host

Write-Host "[5/5] List publish jobs..." -ForegroundColor Cyan
$jobs = Invoke-ApiJson -Method Get -Url "$base/api/videos/$projectId/publish/jobs?tenantId=$TenantId"
$jobs | ConvertTo-Json -Depth 10 | Write-Host

Write-Host "Smoke test completed." -ForegroundColor Green
