#!/bin/bash

echo "正在停止 Monopoly 服務器..."

# 查找運行中的 node server.js 進程
PIDS=$(pgrep -f "node.*server.js")

if [ -z "$PIDS" ]; then
    echo "未找到運行中的 Monopoly 服務器。"
    exit 0
fi

# 處理多個進程的情況
FOUND=0
for PID in $PIDS; do
    echo "找到進程 ID: $PID"
    FOUND=1
done

if [ $FOUND -eq 1 ]; then
    echo "正在停止服務器..."
    
    # 嘗試正常終止
    pkill -f "node.*server.js"
    
    # 等待進程結束
    sleep 1
    
    # 檢查進程是否仍在運行
    REMAINING=$(pgrep -f "node.*server.js")
    if [ -n "$REMAINING" ]; then
        echo "進程仍在運行，強制終止..."
        pkill -9 -f "node.*server.js"
        sleep 1
    fi
    
    # 最終確認
    if pgrep -f "node.*server.js" > /dev/null; then
        echo "錯誤：無法停止服務器。"
        exit 1
    else
        echo "服務器已成功停止。"
        exit 0
    fi
fi

