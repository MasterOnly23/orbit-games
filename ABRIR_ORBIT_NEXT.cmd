@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
set "ORBIT_DATA_DIR="
set "ORBIT_SKIP_SCAN="
set "ORBIT_DEV_URL="
cd /d "%~dp0"
if not exist "release-next\alpha4\win-unpacked\Orbit Games Next.exe" (
  echo Primero ejecuta npm ci y npm run package:dir en esta carpeta.
  pause
  exit /b 1
)
start "" "release-next\alpha4\win-unpacked\Orbit Games Next.exe"
