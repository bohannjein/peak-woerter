@echo off
chcp 65001 >nul
setlocal
title Peake Woerter (lokal)

rem ------------------------------------------------------------------
rem  Peake Woerter lokal starten (ohne Docker).
rem  Doppelklick genuegt. Beenden: dieses Fenster und "Peake DB" schliessen.
rem ------------------------------------------------------------------

rem Der Projektpfad enthaelt "&" (GmbH & Co. KG), daran scheitern npm/cmd.
rem Deshalb wird ueber eine Verknuepfung ohne Sonderzeichen gearbeitet.
set "ROOT=%~dp0"
set "WORK=C:\dev\peake"

where node >nul 2>nul || (
  echo [Fehler] Node.js fehlt. Bitte Node.js 22 oder neuer installieren: https://nodejs.org
  pause & exit /b 1
)

if not exist "%WORK%\package.json" (
  if not exist C:\dev mkdir C:\dev
  mklink /J "%WORK%" "%ROOT:~0,-1%" >nul || (
    echo [Fehler] Verknuepfung %WORK% konnte nicht angelegt werden.
    pause & exit /b 1
  )
)
cd /d "%WORK%"

rem Nur fuer den lokalen Test. Nie in Produktion verwenden.
set "DATABASE_URL=postgresql://peake:peake@localhost:5433/peake"
set "BETTER_AUTH_URL=http://localhost:3000"
set "BETTER_AUTH_SECRET=lokal-nur-zum-testen-lokal-nur-zum-testen-123"
set "SETUP_TOKEN=lokal-setup"
set "DATA_DIR=./.devdata"

if not exist node_modules (
  echo Installiere Abhaengigkeiten ^(einmalig, dauert etwas^) ...
  call npm install --no-audit --no-fund || (pause & exit /b 1)
)

echo Starte lokale Datenbank ...
start "Peake DB" /min cmd /k "cd /d %WORK% && node scripts\dev-db.mjs 5433 .devdb"

rem Warten, bis PostgreSQL wirklich Anfragen annimmt (max. 90 s).
node -e "const {Client}=require('pg');let t=0;(async function f(){const c=new Client(process.env.DATABASE_URL);try{await c.connect();await c.query('select 1');await c.end();process.exit(0)}catch{c.end().catch(()=>{});if(++t>90)process.exit(1);setTimeout(f,1000)}})()" || (
  echo [Fehler] Datenbank startet nicht. Siehe Fenster "Peake DB".
  pause & exit /b 1
)

echo Datenbank-Migrationen ...
node node_modules\prisma\build\index.js migrate deploy || (pause & exit /b 1)
node node_modules\prisma\build\index.js generate >nul || (pause & exit /b 1)

echo.
echo  ===============================================================
echo   Peake Woerter laeuft gleich auf  http://localhost:3000
echo   Erster Start: Setup-Token = lokal-setup
echo   Beenden: Strg+C, danach Fenster "Peake DB" schliessen.
echo  ===============================================================
echo.
start "" "http://localhost:3000"
node node_modules\next\dist\bin\next dev -p 3000

endlocal
