@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\..\.."

echo [UAV] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo [UAV] Node.js not found. Please install Node.js 20+ from https://nodejs.org/
  exit /b 1
)

set "PNPM_CMD="
where pnpm >nul 2>nul
if not errorlevel 1 (
  set "PNPM_CMD=pnpm"
) else (
  where corepack >nul 2>nul
  if not errorlevel 1 (
    echo [UAV] pnpm not found. Enabling pnpm via corepack...
    call corepack enable || exit /b 1
    call corepack prepare pnpm@10.4.1 --activate || exit /b 1
    where pnpm >nul 2>nul
    if not errorlevel 1 (
      set "PNPM_CMD=pnpm"
    ) else (
      set "PNPM_CMD=corepack pnpm"
    )
  ) else (
    where npm >nul 2>nul
    if not errorlevel 1 (
      echo [UAV] pnpm/corepack not found. Falling back to npx pnpm...
      set "PNPM_CMD=npx pnpm"
    ) else (
      echo [UAV] npm/corepack/pnpm not found. Please install Node.js 20+.
      exit /b 1
    )
  )
)

echo [UAV] Using command: %PNPM_CMD%
echo [UAV] Installing dependencies...
call %PNPM_CMD% install || exit /b 1

echo [UAV] Starting development server...
call %PNPM_CMD% dev || exit /b 1
