param(
  [string]$ServerUrl = 'http://127.0.0.1:3000',
  [string]$ElectronExePath = '',
  [int]$WaitSeconds = 60
)

$ErrorActionPreference = 'Stop'

function Write-Step($message) {
  Write-Host "[UAV] $message" -ForegroundColor Cyan
}

function Fail($message) {
  Write-Host "[UAV] $message" -ForegroundColor Red
  exit 1
}

function Get-PackageManagerCommand {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    return 'pnpm'
  }

  if (Get-Command corepack -ErrorAction SilentlyContinue) {
    Write-Step '未检测到 pnpm，正在通过 corepack 启用 pnpm...'
    corepack enable
    corepack prepare pnpm@10.4.1 --activate

    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
      return 'pnpm'
    }

    return 'corepack pnpm'
  }

  if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Step '未检测到 pnpm/corepack，改用 npx pnpm 临时执行。'
    return 'npx pnpm'
  }

  Fail '未检测到 npm/corepack/pnpm，请先安装 Node.js 20+。'
}

function Invoke-PackageManager {
  param(
    [string]$PackageManager,
    [string]$Arguments
  )

  Invoke-Expression "$PackageManager $Arguments"
}

function Wait-ForServer {
  param(
    [string]$HealthUrl,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 5
      if ($response.ok -eq $true) {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  return $false
}

function Find-BuiltElectronExe {
  param([string]$RepoRoot)

  $patterns = @(
    (Join-Path $RepoRoot 'electron-client\dist\*.exe'),
    (Join-Path $RepoRoot 'release\*.exe'),
    (Join-Path $RepoRoot 'dist\*.exe')
  )

  foreach ($pattern in $patterns) {
    $match = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($match) {
      return $match.FullName
    }
  }

  return $null
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail '未检测到 Node.js。请先安装 Node.js 20+： https://nodejs.org/'
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $RepoRoot

$PackageManager = Get-PackageManagerCommand
Write-Step "使用命令：$PackageManager"

Write-Step '正在启动后端开发服务器（新窗口）...'
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-ExecutionPolicy', 'Bypass',
  '-File', (Join-Path $RepoRoot 'scripts\windows\start-dev.ps1')
)

$healthUrl = ($ServerUrl.TrimEnd('/')) + '/api/health'
Write-Step "等待后端健康检查：$healthUrl"

if (-not (Wait-ForServer -HealthUrl $healthUrl -TimeoutSeconds $WaitSeconds)) {
  Fail "后端在 $WaitSeconds 秒内未就绪。请查看新打开的后端窗口日志。"
}

Write-Step '后端已就绪。'

$resolvedExe = $null
if ($ElectronExePath) {
  $candidate = Resolve-Path $ElectronExePath -ErrorAction SilentlyContinue
  if ($candidate) {
    $resolvedExe = $candidate.Path
  } else {
    Fail "指定的 Electron EXE 不存在：$ElectronExePath"
  }
} else {
  $resolvedExe = Find-BuiltElectronExe -RepoRoot $RepoRoot
}

if ($resolvedExe) {
  Write-Step "正在启动已打包 Electron：$resolvedExe"
  Start-Process -FilePath $resolvedExe
  exit 0
}

Write-Step '未找到已打包 EXE，改为启动仓库内的 Electron 开发版。'
Write-Step '正在安装 electron-client 依赖...'
Invoke-PackageManager -PackageManager $PackageManager -Arguments '--dir electron-client install'

Write-Step '正在启动 Electron 开发版（新窗口）...'
$command = "Set-Location '$RepoRoot'; $PackageManager --dir electron-client start"
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-ExecutionPolicy', 'Bypass',
  '-Command', $command
)
