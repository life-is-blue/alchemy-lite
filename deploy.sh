#!/bin/bash
set -eu

VERSION="${RELEASE_VERSION}"
if [ -z "${VERSION}" ]; then
  echo "==> FATAL: RELEASE_VERSION not passed from build stage." >&2
  exit 1
fi

IMAGE="docker.cnb.cool/ai-alchemy-factory/firecrawl-lite:${VERSION}"
PREVIOUS_VERSION_FILE="/opt/firecrawl-lite/current_version.txt"

echo "==> Deploying version ${VERSION} to production" >&2

# Ensure directory exists
mkdir -p "$(dirname "${PREVIOUS_VERSION_FILE}")"

# Save current version for potential rollback
PREVIOUS_VERSION=$(cat "${PREVIOUS_VERSION_FILE}" 2>/dev/null || echo "none")
echo "==> Previous version: ${PREVIOUS_VERSION}" >&2

# Pull new image
echo "${REGISTRY_TOKEN}" | docker login -u "${REGISTRY_USER}" --password-stdin docker.cnb.cool >&2
docker pull "${IMAGE}" >&2

# Deploy new version
docker stop firecrawl-lite >&2 || true
docker rm firecrawl-lite >&2 || true
docker run -d -p 80:3000 \
  --name firecrawl-lite \
  --restart=always \
  -e VERSION="${VERSION}" \
  "${IMAGE}" >&2

# Health check
echo "==> Running health check..." >&2
for i in $(seq 1 10); do
  if curl -fsS http://127.0.0.1:80/health >&2; then
    echo "${VERSION}" > "${PREVIOUS_VERSION_FILE}"
    echo "==> Deployment successful. Version ${VERSION} is live." >&2
    exit 0
  fi
  echo "==> Health check attempt ${i}/10 failed. Retrying..." >&2
  sleep 3
done

# Health check failed - attempt rollback
echo "==> FATAL: Health check failed for ${VERSION}." >&2
if [ "${PREVIOUS_VERSION}" != "none" ]; then
  echo "==> Attempting automatic rollback to ${PREVIOUS_VERSION}..." >&2
  ROLLBACK_IMAGE="docker.cnb.cool/ai-alchemy-factory/firecrawl-lite:${PREVIOUS_VERSION}"
  docker pull "${ROLLBACK_IMAGE}" >&2 || true
  docker stop firecrawl-lite >&2 || true
  docker rm firecrawl-lite >&2 || true
  docker run -d -p 80:3000 \
    --name firecrawl-lite \
    --restart=always \
    -e VERSION="${PREVIOUS_VERSION}" \
    "${ROLLBACK_IMAGE}" >&2
  
  # Verify rollback
  echo "==> Verifying rollback health..." >&2
  for i in $(seq 1 10); do
    if curl -fsS http://127.0.0.1:80/health >&2; then
      echo "==> Rollback to ${PREVIOUS_VERSION} successful." >&2
      echo "==> WARNING: New version ${VERSION} failed and was rolled back." >&2
      exit 1
    fi
    sleep 3
  done
  
  echo "==> CRITICAL: Rollback to ${PREVIOUS_VERSION} also failed." >&2
  echo "==> Production is DOWN. Manual intervention REQUIRED IMMEDIATELY." >&2
fi
exit 1
