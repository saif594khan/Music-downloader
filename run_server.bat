@echo off
title Local Audio Downloader Server

:: 1. Check if node_modules folder exists. If it doesn't, install it.
if not exist node_modules call npm install

:: 2. Launch server.js completely hidden in the background FIRST
echo [System] Launching background server...
echo CreateObject("Wscript.Shell").Run "node server.js", 0, False > "%temp%\start_server.vbs"
wscript "%temp%\start_server.vbs"
del "%temp%\start_server.vbs"

:: 3. Wait 2 seconds to give the server a moment to start up
timeout /t 2 /nobreak >nul

:: 4. Launch Google Chrome automatically now that the server is ready
echo [System] Launching browser and closing this window...
start chrome "http://localhost:8080"

:: 5. Exit this terminal immediately
exit