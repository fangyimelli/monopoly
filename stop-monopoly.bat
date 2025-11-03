@echo off
setlocal enabledelayedexpansion
echo 正在停止 Monopoly 服務器...

set FOUND=0

REM 查找所有 node.exe 進程並檢查命令行參數
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST 2^>nul ^| findstr /C:"PID:"') do (
    set PID=%%i
    REM 檢查該進程的命令行參數是否包含 server.js
    wmic process where "ProcessId=!PID!" get CommandLine 2>nul | findstr /C:"server.js" >nul
    if !errorlevel! equ 0 (
        echo 找到進程 ID: !PID!
        echo 正在停止服務器...
        taskkill /F /PID !PID! >nul 2>&1
        if !errorlevel! equ 0 (
            set FOUND=1
            echo 服務器已成功停止。
        ) else (
            echo 錯誤：無法停止進程 !PID!。
        )
    )
)

if !FOUND! equ 0 (
    echo 未找到運行中的 Monopoly 服務器。
)

pause
exit /b 0

