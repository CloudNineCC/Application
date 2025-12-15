#!/bin/bash

set -e

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-cloudnine-475221}"
REGION="us-central1"

echo "==================================================================="
echo "Cloud Run Services Rollback"
echo "==================================================================="

# List services
echo ""
echo "Available Cloud Run services:"
gcloud run services list --platform managed --region ${REGION} --project ${PROJECT_ID}

echo ""
read -p "Enter service name to rollback (itineraries-ms or travel-planner-ms): " SERVICE_NAME

if [[ ! "$SERVICE_NAME" =~ ^(itineraries-ms|travel-planner-ms)$ ]]; then
  echo "ERROR: Invalid service name"
  exit 1
fi

# Show revisions
echo ""
echo "Available revisions for ${SERVICE_NAME}:"
gcloud run revisions list \
  --service ${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --project ${PROJECT_ID}

echo ""
read -p "Enter revision name to rollback to: " REVISION_NAME

# Rollback to specified revision
echo ""
echo "Rolling back ${SERVICE_NAME} to ${REVISION_NAME}..."
gcloud run services update-traffic ${SERVICE_NAME} \
  --to-revisions ${REVISION_NAME}=100 \
  --platform managed \
  --region ${REGION} \
  --project ${PROJECT_ID}

echo ""
echo "Rollback completed. Verifying..."
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format 'value(status.url)')

curl -f "${SERVICE_URL}/health" && echo "✓ Service is healthy" || echo "✗ Health check failed"
