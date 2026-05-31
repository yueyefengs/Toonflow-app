#!/bin/sh
# 将镜像内置的应用文件同步到挂载的数据目录（仅当目录不存在时复制）
for dir in web skills models vendor modelPrompt assets; do
  if [ -d /app/data-bak/$dir ] && [ ! -d /app/data/$dir ]; then
    cp -r /app/data-bak/$dir /app/data/$dir
  fi
done
if [ -f /app/data-bak/version.txt ] && [ ! -f /app/data/version.txt ]; then
  cp /app/data-bak/version.txt /app/data/version.txt
fi
exec "$@"
