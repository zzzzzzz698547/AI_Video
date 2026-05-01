@echo off
setlocal EnableExtensions

cd /d "%~dp0.."

set "ROOT=%~dp0.."
set "PG_BIN=C:\Program Files\PostgreSQL\18\bin\postgres.exe"
set "PG_DATA=C:\Program Files\PostgreSQL\18\data"
set "REDIS8_HOME=%ROOT%\.tools\redis-windows-8.6.2\Redis-8.6.2-Windows-x64-cygwin-with-Service"
set "REDIS8_BIN=%REDIS8_HOME%\redis-server.exe"
set "REDIS8_CONF=/cygdrive/c/Users/user/Desktop/AI-VIDIO/.tools/redis-windows-8.6.2/redis-6380.conf"
set "API_PORT=3001"
set "WEB_PORT=3000"
set "ADMIN_PORT=3002"
set "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_vidio?schema=public"
set "REDIS_URL=redis://localhost:6380"
set "CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3002"
set "NEXT_PUBLIC_API_BASE_URL=http://localhost:3001"

echo ==========================================
echo   AI-VIDIO One-Click Start
echo ==========================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker not found. Skipping postgres and redis containers.
  call :ensure_postgres_running
  call :ensure_redis_running
) else (
  echo Starting postgres and redis...
  docker compose up -d postgres redis
  set "REDIS_URL=redis://localhost:6379"
)

echo.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":3000 .*LISTENING"') do taskkill /F /PID %%P >nul 2>nul
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":3001 .*LISTENING"') do taskkill /F /PID %%P >nul 2>nul
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":3002 .*LISTENING"') do taskkill /F /PID %%P >nul 2>nul

echo Generating Prisma client...
call npm run prisma:generate
if errorlevel 1 echo Prisma generate failed, continuing...

echo.
echo Syncing Prisma schema...
call npm --workspace @ai-vidio/api run db:push
if errorlevel 1 echo Prisma db push failed, continuing...

echo.
echo Launching services...
start "AI-VIDIO API" /D "%ROOT%" cmd /k "set PORT=%API_PORT% && call npm run dev:api"
start "AI-VIDIO Web" /D "%ROOT%" cmd /k "set PORT=%WEB_PORT% && call npm run dev:web"
start "AI-VIDIO Admin" /D "%ROOT%" cmd /k "set PORT=%ADMIN_PORT% && call npm run dev:admin"

timeout /t 8 /nobreak >nul

call :open_private_browser "http://localhost:%WEB_PORT%"
call :open_private_browser "http://localhost:%ADMIN_PORT%"
call :open_private_browser "http://localhost:%API_PORT%"

echo.
echo AI-VIDIO started.
echo Close this window when you are done.
goto :eof

:ensure_postgres_running
netstat -ano | findstr /r /c:":5432 .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo PostgreSQL is already listening on 5432.
  exit /b 0
)

if exist "%PG_BIN%" (
  echo Starting local PostgreSQL service process...
  start "" /b "%PG_BIN%" -D "%PG_DATA%" -p 5432 > "%ROOT%\scripts\postgres-start.log" 2>&1
  timeout /t 5 /nobreak >nul
  netstat -ano | findstr /r /c:":5432 .*LISTENING" >nul 2>nul
  if errorlevel 1 (
    echo PostgreSQL could not be started automatically.
  ) else (
    echo PostgreSQL started locally on 5432.
  )
) else (
  echo PostgreSQL binary not found at "%PG_BIN%".
)
exit /b 0

:open_private_browser
set "URL=%~1"
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
  start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --inprivate "%URL%"
  exit /b 0
)
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
  start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --inprivate "%URL%"
  exit /b 0
)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --incognito "%URL%"
  exit /b 0
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
  start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --incognito "%URL%"
  exit /b 0
)
start "" "%URL%"
exit /b 0

:ensure_redis_running
netstat -ano | findstr /r /c:":6380 .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo Redis 8 is already listening on 6380.
  exit /b 0
)

if exist "%REDIS8_BIN%" (
  echo Starting local Redis 8 server...
  start "" /b "%REDIS8_BIN%" "%REDIS8_CONF%" > "%ROOT%\scripts\redis-start.log" 2>&1
  timeout /t 5 /nobreak >nul
  netstat -ano | findstr /r /c:":6380 .*LISTENING" >nul 2>nul
  if errorlevel 1 (
    echo Redis could not be started automatically.
  ) else (
    echo Redis 8 started locally on 6380.
  )
) else (
  echo Redis 8 binary not found at "%REDIS8_BIN%".
)
exit /b 0
