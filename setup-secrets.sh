#!/bin/bash

set -e

PROJECT_ID="cloudnine-475221"

echo "==================================================================="
echo "Setting up Google Cloud Secrets"
echo "Project: ${PROJECT_ID}"
echo "==================================================================="

# Enable Secret Manager API
echo ""
echo "Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project ${PROJECT_ID}

# Itineraries DB Password
echo ""
read -sp "Enter password for itineraries-db: " ITINERARIES_DB_PASSWORD
echo ""
echo -n "${ITINERARIES_DB_PASSWORD}" | gcloud secrets create itineraries-db-password \
  --data-file=- \
  --project ${PROJECT_ID} \
  --replication-policy="automatic" 2>/dev/null || \
echo -n "${ITINERARIES_DB_PASSWORD}" | gcloud secrets versions add itineraries-db-password \
  --data-file=- \
  --project ${PROJECT_ID}
echo "✓ Created/updated itineraries-db-password"

# JWT Secret
echo ""
read -sp "Enter JWT secret for authentication: " JWT_SECRET
echo ""
echo -n "${JWT_SECRET}" | gcloud secrets create jwt-secret \
  --data-file=- \
  --project ${PROJECT_ID} \
  --replication-policy="automatic" 2>/dev/null || \
echo -n "${JWT_SECRET}" | gcloud secrets versions add jwt-secret \
  --data-file=- \
  --project ${PROJECT_ID}
echo "✓ Created/updated jwt-secret"

# Google Client ID
echo ""
read -p "Enter Google OAuth Client ID: " GOOGLE_CLIENT_ID
echo -n "${GOOGLE_CLIENT_ID}" | gcloud secrets create google-client-id \
  --data-file=- \
  --project ${PROJECT_ID} \
  --replication-policy="automatic" 2>/dev/null || \
echo -n "${GOOGLE_CLIENT_ID}" | gcloud secrets versions add google-client-id \
  --data-file=- \
  --project ${PROJECT_ID}
echo "✓ Created/updated google-client-id"

# Grant Cloud Run service account access to secrets
echo ""
echo "Granting Cloud Run access to secrets..."
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in itineraries-db-password jwt-secret google-client-id; do
  gcloud secrets add-iam-policy-binding ${SECRET} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --project ${PROJECT_ID} > /dev/null
  echo "✓ Granted access to ${SECRET}"
done

echo ""
echo "==================================================================="
echo "Secrets setup completed!"
echo "==================================================================="
