# DiffSense 可发布制品：build 阶段装好依赖，运行时零安装
# 构建: docker build -t ghcr.io/yourname/diffsense:1.0.0 .
# 运行: docker run --rm -e DIFFSENSE_TOKEN=xxx ghcr.io/yourname/diffsense:1.0.0 audit --platform gitlab ...
FROM python:3.12-slim

WORKDIR /app

COPY . .
RUN pip install --no-cache-dir .

ENTRYPOINT ["diffsense"]
CMD ["audit", "--help"]
