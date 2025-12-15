#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="cloudnine-475221"
REGION="us-central1"
ZONE="us-central1-c"
VM_NAME="microservice"
SSH_KEY_FILE="${SSH_KEY_FILE:-$HOME/.ssh/databasesql}"

# Parse command line arguments
SKIP_VM=false
SKIP_CLOUDRUN=false
SKIP_FRONTEND=false
SKIP_FUNCTION=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-vm)
      SKIP_VM=true
      shift
      ;;
    --skip-cloudrun)
      SKIP_CLOUDRUN=true
      shift
      ;;
    --skip-frontend)
      SKIP_FRONTEND=true
      shift
      ;;
    --skip-function)
      SKIP_FUNCTION=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--skip-vm] [--skip-cloudrun] [--skip-frontend] [--skip-function]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}=======================================================================${NC}"
echo -e "${BLUE}        Travel Planner - Unified Redeployment Script${NC}"
echo -e "${BLUE}=======================================================================${NC}"
echo ""
echo "This script will redeploy all application services (excluding databases)."
echo ""
echo "Services to deploy:"
if [ "$SKIP_VM" = false ]; then
  echo "  ✓ VM Services (DestinationsMS, PricingMS)"
fi
if [ "$SKIP_CLOUDRUN" = false ]; then
  echo "  ✓ Cloud Run Services (ItinerariesMS, TravelPlannerMS)"
fi
if [ "$SKIP_FRONTEND" = false ]; then
  echo "  ✓ Frontend (Cloud Storage)"
fi
if [ "$SKIP_FUNCTION" = false ]; then
  echo "  ✓ Cloud Function (processItineraryEvent)"
fi
echo ""
read -p "Continue with redeployment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Redeployment cancelled."
  exit 1
fi

# Track deployment status
FAILURES=()

# Function to check command success
check_status() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ $1 successful${NC}"
    return 0
  else
    echo -e "${RED}✗ $1 failed${NC}"
    FAILURES+=("$1")
    return 1
  fi
}

# Function to verify health endpoint
verify_health() {
  local url=$1
  local service_name=$2
  echo -e "${YELLOW}Verifying $service_name health...${NC}"

  if curl -s -f "$url" > /dev/null; then
    echo -e "${GREEN}✓ $service_name is healthy${NC}"
  else
    echo -e "${RED}✗ $service_name health check failed${NC}"
    FAILURES+=("$service_name health check")
  fi
}

# ===================================================================
# 1. Deploy VM-Based Services
# ===================================================================
if [ "$SKIP_VM" = false ]; then
  echo ""
  echo -e "${BLUE}=======================================================================${NC}"
  echo -e "${BLUE}  Step 1: Deploying VM-Based Services${NC}"
  echo -e "${BLUE}=======================================================================${NC}"
  echo ""

  # DestinationsMS
  echo -e "${YELLOW}Deploying DestinationsMS...${NC}"
  (cd DestinationsMS && ./deploy-vm.sh)
  check_status "DestinationsMS deployment"

  # PricingMS
  echo -e "${YELLOW}Deploying PricingMS...${NC}"
  (cd PricingMS && ./deploy-vm.sh)
  check_status "PricingMS deployment"

  # Verify VM services
  sleep 5
  verify_health "http://136.113.150.64:3001/health" "DestinationsMS"
  verify_health "http://136.113.150.64:3002/health" "PricingMS"
else
  echo ""
  echo -e "${YELLOW}Skipping VM-based services deployment${NC}"
fi

# ===================================================================
# 2. Deploy Cloud Run Services
# ===================================================================
if [ "$SKIP_CLOUDRUN" = false ]; then
  echo ""
  echo -e "${BLUE}=======================================================================${NC}"
  echo -e "${BLUE}  Step 2: Deploying Cloud Run Services${NC}"
  echo -e "${BLUE}=======================================================================${NC}"
  echo ""

  # ItinerariesMS
  echo -e "${YELLOW}Deploying ItinerariesMS...${NC}"
  (cd ItinerariesMS && ./deploy.sh)
  check_status "ItinerariesMS deployment"

  # TravelPlannerMS
  echo -e "${YELLOW}Deploying TravelPlannerMS...${NC}"
  (cd TravelPlannerMS && ./deploy.sh)
  check_status "TravelPlannerMS deployment"

  # Verify Cloud Run services
  sleep 10
  verify_health "https://itineraries-ms-izocsrgyaq-uc.a.run.app/health" "ItinerariesMS"
  verify_health "https://travel-planner-ms-izocsrgyaq-uc.a.run.app/health" "TravelPlannerMS"
else
  echo ""
  echo -e "${YELLOW}Skipping Cloud Run services deployment${NC}"
fi

# ===================================================================
# 3. Deploy Frontend
# ===================================================================
if [ "$SKIP_FRONTEND" = false ]; then
  echo ""
  echo -e "${BLUE}=======================================================================${NC}"
  echo -e "${BLUE}  Step 3: Deploying Frontend${NC}"
  echo -e "${BLUE}=======================================================================${NC}"
  echo ""

  echo -e "${YELLOW}Deploying Frontend to Cloud Storage...${NC}"
  (cd Application && ./deploy-updated.sh)
  check_status "Frontend deployment"

  # Verify frontend
  sleep 3
  if curl -s -I "https://storage.googleapis.com/travel-planner-frontend-cloudnine/index.html" | grep -q "200 OK"; then
    echo -e "${GREEN}✓ Frontend is accessible${NC}"
  else
    echo -e "${RED}✗ Frontend accessibility check failed${NC}"
    FAILURES+=("Frontend accessibility check")
  fi
else
  echo ""
  echo -e "${YELLOW}Skipping Frontend deployment${NC}"
fi

# ===================================================================
# 4. Deploy Cloud Function
# ===================================================================
if [ "$SKIP_FUNCTION" = false ]; then
  echo ""
  echo -e "${BLUE}=======================================================================${NC}"
  echo -e "${BLUE}  Step 4: Deploying Cloud Function${NC}"
  echo -e "${BLUE}=======================================================================${NC}"
  echo ""

  echo -e "${YELLOW}Deploying Cloud Function (processItineraryEvent)...${NC}"
  (cd CloudFunction && ./deploy.sh)
  check_status "Cloud Function deployment"

  # Verify function exists
  if gcloud functions describe processItineraryEvent --region=$REGION --gen2 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Cloud Function is deployed${NC}"
  else
    echo -e "${RED}✗ Cloud Function deployment verification failed${NC}"
    FAILURES+=("Cloud Function verification")
  fi
else
  echo ""
  echo -e "${YELLOW}Skipping Cloud Function deployment${NC}"
fi

# ===================================================================
# Deployment Summary
# ===================================================================
echo ""
echo -e "${BLUE}=======================================================================${NC}"
echo -e "${BLUE}  Deployment Summary${NC}"
echo -e "${BLUE}=======================================================================${NC}"
echo ""

if [ ${#FAILURES[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ All deployments completed successfully!${NC}"
  echo ""
  echo "Service URLs:"
  echo "  Frontend:        https://storage.googleapis.com/travel-planner-frontend-cloudnine/index.html"
  echo "  TravelPlannerMS: https://travel-planner-ms-izocsrgyaq-uc.a.run.app"
  echo "  ItinerariesMS:   https://itineraries-ms-izocsrgyaq-uc.a.run.app"
  echo "  DestinationsMS:  http://136.113.150.64:3001"
  echo "  PricingMS:       http://136.113.150.64:3002"
  echo ""
  echo "Next steps:"
  echo "  1. Test the application end-to-end"
  echo "  2. Check service logs if needed:"
  echo "     - VM services: gcloud compute ssh $VM_NAME --zone=$ZONE --command=\"pm2 logs\""
  echo "     - Cloud Run: gcloud run services logs tail <service-name> --region $REGION"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some deployments failed:${NC}"
  for failure in "${FAILURES[@]}"; do
    echo -e "${RED}  - $failure${NC}"
  done
  echo ""
  echo "Please check the output above for details and retry failed deployments individually."
  echo ""
  exit 1
fi
