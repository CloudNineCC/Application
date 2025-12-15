#!/bin/bash

set -e

BUCKET_NAME="travel-planner-frontend-cloudnine"

echo "Deploying frontend to Cloud Storage..."

# Upload files to bucket
echo "Uploading files..."
gsutil -m cp -r *.html *.css *.js gs://${BUCKET_NAME}/

# Set cache control headers to prevent caching
echo "Setting cache control headers..."
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" \
  gs://${BUCKET_NAME}/*.html \
  gs://${BUCKET_NAME}/*.css \
  gs://${BUCKET_NAME}/*.js

# Ensure public access
echo "Setting public access..."
gsutil iam ch allUsers:objectViewer gs://${BUCKET_NAME}

echo "✓ Frontend deployed successfully!"
echo "URL: https://storage.googleapis.com/${BUCKET_NAME}/index.html"
