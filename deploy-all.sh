#!/bin/bash

set -e

PROJECT_ID="cloudnine-475221"
REGION="us-central1"

echo "######################################################################"
echo "#                                                                    #"
echo "#     Travel Planner - Complete Deployment Orchestration             #"
echo "#                                                                    #"
echo "######################################################################"
echo ""
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

# Function to prompt for continuation
prompt_continue() {
  read -p "Continue with $1? (y/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping $1"
    return 1
  fi
  return 0
}

# Step 1: Database Deployments
echo ""
echo "======================================================================"
echo "STEP 1: Database Deployments"
echo "======================================================================"
echo ""
echo "This will deploy all database schemas and seed data."
echo "WARNING: This will DROP and RECREATE databases!"
echo ""

if prompt_continue "database deployments"; then
  cd Database

  echo ""
  echo "[1.1] Deploying destinations_db..."
  export DB_HOST=34.55.101.72
  export DB_USER=root
  read -sp "Enter Cloud SQL root password for destinations-db: " DB_PASSWORD
  export DB_PASSWORD
  echo ""
  bash deploy-destinations-db.sh

  echo ""
  echo "[1.2] Deploying itineraries_db..."
  export DB_HOST=136.119.166.207
  read -sp "Enter Cloud SQL root password for itineraries-db: " DB_PASSWORD
  export DB_PASSWORD
  echo ""
  bash deploy-itineraries-db.sh

  echo ""
  echo "[1.3] Deploying pricing_db (on VM)..."
  export DB_HOST=10.128.0.3
  read -sp "Enter MySQL root password for pricing-db: " DB_PASSWORD
  export DB_PASSWORD
  echo ""
  bash deploy-pricing-db.sh

  cd ..
fi

# Step 2: VM-Based Microservices
echo ""
echo "======================================================================"
echo "STEP 2: VM-Based Microservices Deployment"
echo "======================================================================"
echo ""
echo "Deploy DestinationsMS and PricingMS to microservice VM"
echo ""

if prompt_continue "VM microservices deployment"; then
  echo ""
  echo "[2.1] Deploying DestinationsMS..."
  cd DestinationsMS
  bash deploy-vm.sh
  cd ..

  echo ""
  echo "[2.2] Deploying PricingMS..."
  cd PricingMS
  bash deploy-vm.sh
  cd ..

  # Wait for services to stabilize
  echo ""
  echo "Waiting 10 seconds for services to stabilize..."
  sleep 10
fi

# Step 3: Cloud Run Microservices
echo ""
echo "======================================================================"
echo "STEP 3: Cloud Run Microservices Deployment"
echo "======================================================================"
echo ""
echo "Deploy ItinerariesMS and TravelPlannerMS to Cloud Run"
echo ""

if prompt_continue "Cloud Run microservices deployment"; then
  echo ""
  echo "[3.1] Deploying ItinerariesMS..."
  cd ItinerariesMS
  bash deploy.sh
  cd ..

  echo ""
  echo "[3.2] Deploying TravelPlannerMS (Gateway)..."
  cd TravelPlannerMS
  # Set environment variables for downstream services
  export DESTINATIONS_MS_URL="http://34.69.219.252:3001"
  export PRICING_MS_URL="http://34.69.219.252:3002"
  export ITINERARIES_MS_URL=$(gcloud run services describe itineraries-ms \
    --platform managed \
    --region us-central1 \
    --project cloudnine-475221 \
    --format 'value(status.url)')
  bash deploy.sh
  cd ..

  # Wait for services to stabilize
  echo ""
  echo "Waiting 10 seconds for services to stabilize..."
  sleep 10
fi

# Step 4: Frontend Deployment
echo ""
echo "======================================================================"
echo "STEP 4: Frontend Deployment"
echo "======================================================================"
echo ""
echo "Deploy static frontend to Cloud Storage"
echo ""

if prompt_continue "frontend deployment"; then
  cd Application
  bash deploy-updated.sh
  cd ..
fi

# Step 5: Post-Deployment Verification
echo ""
echo "======================================================================"
echo "STEP 5: Post-Deployment Verification"
echo "======================================================================"
echo ""

# Get service URLs
TRAVEL_PLANNER_URL=$(gcloud run services describe travel-planner-ms \
  --platform managed \
  --region us-central1 \
  --project cloudnine-475221 \
  --format 'value(status.url)' 2>/dev/null || echo "Not deployed")

ITINERARIES_URL=$(gcloud run services describe itineraries-ms \
  --platform managed \
  --region us-central1 \
  --project cloudnine-475221 \
  --format 'value(status.url)' 2>/dev/null || echo "Not deployed")

echo "Service Endpoints:"
echo "  DestinationsMS:    http://34.69.219.252:3001"
echo "  PricingMS:         http://34.69.219.252:3002"
echo "  ItinerariesMS:     ${ITINERARIES_URL}"
echo "  TravelPlannerMS:   ${TRAVEL_PLANNER_URL}"
echo "  Frontend:          https://storage.googleapis.com/travel-planner-frontend-cloudnine/index.html"
echo ""

echo "Testing endpoints..."
echo ""

# Test DestinationsMS
echo "[Testing DestinationsMS]"
curl -f -s "http://34.69.219.252:3001/health" > /dev/null && echo "  ✓ DestinationsMS is healthy" || echo "  ✗ DestinationsMS health check failed"

# Test PricingMS
echo "[Testing PricingMS]"
curl -f -s "http://34.69.219.252:3002/health" > /dev/null && echo "  ✓ PricingMS is healthy" || echo "  ✗ PricingMS health check failed"

# Test ItinerariesMS
if [ "$ITINERARIES_URL" != "Not deployed" ]; then
  echo "[Testing ItinerariesMS]"
  curl -f -s "${ITINERARIES_URL}/health" > /dev/null && echo "  ✓ ItinerariesMS is healthy" || echo "  ✗ ItinerariesMS health check failed"
fi

# Test TravelPlannerMS
if [ "$TRAVEL_PLANNER_URL" != "Not deployed" ]; then
  echo "[Testing TravelPlannerMS]"
  curl -f -s "${TRAVEL_PLANNER_URL}/health" > /dev/null && echo "  ✓ TravelPlannerMS is healthy" || echo "  ✗ TravelPlannerMS health check failed"
fi

echo ""
echo "######################################################################"
echo "#                                                                    #"
echo "#              Deployment Orchestration Complete!                    #"
echo "#                                                                    #"
echo "######################################################################"
echo ""
