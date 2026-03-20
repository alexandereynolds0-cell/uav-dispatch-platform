$ErrorActionPreference = 'Stop'

function Write-Step($message) {
  Write-Host "[UAV] $message" -ForegroundColor Cyan
}

function Fail($message) {
  Write-Host "[UAV] $message" -ForegroundColor Red
  exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail '未检测到 Node.js。请先安装 Node.js 20+： https://nodejs.org/'
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $RepoRoot

$pnpmCommand = $null

if (Get-Command pnpm -ErrorAction SilentlyContinue) {
  $pnpmCommand = 'pnpm'
} elseif (Get-Command corepack -ErrorAction SilentlyContinue) {
  Write-Step '未检测到 pnpm，正在通过 corepack 启用 pnpm...'
  corepack enable
  corepack prepare pnpm@10.4.1 --activate
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $pnpmCommand = 'pnpm'
  } else {
    $pnpmCommand = 'corepack pnpm'
  }
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
  Write-Step '未检测到 pnpm/corepack，改用 npx pnpm 临时执行。'
  $pnpmCommand = 'npx pnpm'
} else {
  Fail '未检测到 npm/corepack/pnpm，请先安装 Node.js。'
}

Write-Step "使用命令：$pnpmCommand"
Write-Step '安装依赖...'
Invoke-Expression "$pnpmCommand install"

Write-Step '启动开发服务器...'
Invoke-Expression "$pnpmCommand dev"
