#!/bin/sh
# 将镜像内置的 web、skills 文件同步到挂载的数据目录
if [ -d /app/data-bak/web ] && [ ! -d /app/data/web ]; then
  cp -r /app/data-bak/web /app/data/web
fi
if [ -d /app/data-bak/skills ] && [ ! -d /app/data/skills ]; then
  cp -r /app/data-bak/skills /app/data/skills
fi
exec "$@"
