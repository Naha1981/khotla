#!/bin/bash
cd /home/z/my-project
while true; do
  node server.js >> dev.log 2>&1
  echo "[$(date)] Server crashed, restarting in 3s..." >> dev.log
  sleep 3
done
