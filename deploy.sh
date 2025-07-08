#!/bin/bash

# Artifact Registryへのpushスクリプト
GIT_HASH=$(git rev-parse --short HEAD)

source ./.env

# 設定
PROJECT_ID=${GCP_PROJECT_ID}
SERVICE_NAME=${GCP_SERVICE_NAME}
REPOSITORY_NAME=${GCP_REPOSITORY_NAME}
JOB_NAME=${GCP_JOB_NAME}
REGION=${GCP_REGION}
IMAGE_NAME="asia-northeast1-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_REPOSITORY_NAME}/${SERVICE_NAME}:${GIT_HASH}"
MEMORY=${GCP_MEMORY}
CPU=${GCP_CPU}
TIMEOUT=${GCP_TIMEOUT}
MAX_RETRIES=${GCP_MAX_RETRIES}
NODE_ENV="production"

docker buildx build --platform linux/amd64 -t ${IMAGE_NAME} .
docker push ${IMAGE_NAME}
