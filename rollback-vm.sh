#!/bin/bash

set -e

VM_NAME="microservice"
VM_ZONE="us-central1-c"
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-cloudnine-475221}"
SSH_KEY_FILE="${SSH_KEY_FILE:-$HOME/.ssh/databasesql}"

echo "==================================================================="
echo "VM Services Rollback"
echo "VM: ${VM_NAME}"
echo "==================================================================="

# Show current PM2 processes
echo ""
echo "Current PM2 processes:"
gcloud compute ssh --ssh-key-file=${SSH_KEY_FILE} ${VM_NAME} \
  --zone=${VM_ZONE} \
  --project=${PROJECT_ID} \
  --command="pm2 list"

echo ""
read -p "Enter service name to rollback (destinations-ms or pricing-ms): " SERVICE_NAME

if [[ ! "$SERVICE_NAME" =~ ^(destinations-ms|pricing-ms)$ ]]; then
  echo "ERROR: Invalid service name. Must be 'destinations-ms' or 'pricing-ms'"
  exit 1
fi

echo ""
echo "Restarting ${SERVICE_NAME}..."
gcloud compute ssh --ssh-key-file=${SSH_KEY_FILE} ${VM_NAME} \
  --zone=${VM_ZONE} \
  --project=${PROJECT_ID} \
  --command="pm2 restart ${SERVICE_NAME}"

echo ""
echo "Service restarted. Checking logs..."
gcloud compute ssh --ssh-key-file=${SSH_KEY_FILE} ${VM_NAME} \
  --zone=${VM_ZONE} \
  --project=${PROJECT_ID} \
  --command="pm2 logs ${SERVICE_NAME} --lines 20 --nostream"
