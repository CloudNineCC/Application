# Travel Planner - Deployment Guide

This guide provides comprehensive instructions for deploying and managing the Travel Planner application on Google Cloud Platform.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Scenarios](#deployment-scenarios)
4. [One-Time Setup](#one-time-setup)
5. [Service Deployment](#service-deployment)
6. [Database Deployment](#database-deployment)
7. [Verification](#verification)
8. [Rollback Procedures](#rollback-procedures)
9. [Environment Configuration](#environment-configuration)
10. [Troubleshooting](#troubleshooting)

## Architecture Overview

### Services

| Service | Type | Location | Port/URL |
|---------|------|----------|----------|
| **DestinationsMS** | VM-based | microservice VM (us-central1-c) | 3001 |
| **PricingMS** | VM-based | microservice VM (us-central1-c) | 3002 |
| **ItinerariesMS** | Cloud Run | us-central1 | https://itineraries-ms-izocsrgyaq-uc.a.run.app |
| **TravelPlannerMS** | Cloud Run | us-central1 | https://travel-planner-ms-izocsrgyaq-uc.a.run.app |
| **Frontend** | Cloud Storage | - | https://storage.googleapis.com/travel-planner-frontend-cloudnine/index.html |
| **CloudFunction** | Cloud Functions Gen 2 | us-central1 | Event-driven (Pub/Sub) |

### Databases

| Database | Type | Location | IP Address |
|----------|------|----------|------------|
| `destinations_db` | Cloud SQL MySQL | us-central1-c | 34.55.101.72 |
| `itineraries_db` | Cloud SQL MySQL | us-central1-c | 136.119.166.207 |
| `pricing_db` | VM MySQL | database-sql VM (us-central1-a) | 10.128.0.3 (internal) |

### GCP Resources

| Resource Type | Name | Zone/Region | External IP |
|---------------|------|-------------|-------------|
| Compute Engine VM | microservice | us-central1-c | 136.113.150.64 |
| Compute Engine VM | database-sql | us-central1-a | 34.46.125.108 |

## Prerequisites

### Required Tools

- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and configured
- Node.js 20+ and npm
- MySQL client (for database operations)
- Docker (optional, for local testing)

### Required Access

- Google Cloud Project: `cloudnine-475221`
- IAM permissions:
  - Compute Admin (for VM management)
  - Cloud Run Admin (for Cloud Run services)
  - Cloud SQL Admin (for database management)
  - Secret Manager Admin (for credentials)
  - Storage Admin (for frontend hosting)
  - Cloud Functions Admin (for function deployment)

### SSH Key Setup

For VM access, ensure you have the SSH key:
```bash
SSH_KEY_FILE=$HOME/.ssh/databasesql
```

All VM deployment scripts automatically use this key.

## Deployment Scenarios

### Scenario 1: Iterative Deployment (Most Common)

**Use when**: You've made code changes to one or more services and need to deploy updates.

**What to skip**:
- ❌ `setup-secrets.sh` - Secrets already exist
- ❌ `setup-vm.sh` - VM already configured
- ❌ `deploy-all.sh` - Too comprehensive for updates
- ❌ Database deployment scripts - Unless schema changed

**What to run**:
Only deploy the services you modified:

| Service Modified | Command |
|-----------------|---------|
| DestinationsMS | `cd DestinationsMS && ./deploy-vm.sh` |
| PricingMS | `cd PricingMS && ./deploy-vm.sh` |
| ItinerariesMS | `cd ItinerariesMS && ./deploy.sh` |
| TravelPlannerMS | `cd TravelPlannerMS && ./deploy.sh` |
| Frontend | `cd Application && ./deploy-updated.sh` |
| CloudFunction | `cd CloudFunction && ./deploy.sh` |

**Example workflow**:
```bash
# You modified DestinationsMS and Frontend
cd DestinationsMS && ./deploy-vm.sh && cd ..
cd Application && ./deploy-updated.sh && cd ..

# Verify deployment
curl http://136.113.150.64:3001/health
```

### Scenario 2: First-Time/Full Deployment

**Use when**: Setting up the application for the first time or rebuilding from scratch.

```bash
# 1. One-time setup
./setup-secrets.sh    # Configure Google Secret Manager
./setup-vm.sh         # Install Node.js and PM2 on VM

# 2. Deploy everything
./deploy-all.sh       # Interactive deployment wizard
```

The `deploy-all.sh` script walks you through deploying:
1. All databases (destinations_db, itineraries_db, pricing_db)
2. VM-based microservices (DestinationsMS, PricingMS)
3. Cloud Run microservices (ItinerariesMS, TravelPlannerMS)
4. Frontend (Cloud Storage)
5. Cloud Function (event processor)

### Scenario 3: Quick Redeploy Everything

**Use when**: You want to redeploy all services quickly.

```bash
./redeploy-all.sh
```

See [Unified Redeployment Script](#unified-redeployment-script) section for details.

## One-Time Setup

### 1. Setup Google Secret Manager

Creates/updates required secrets for the application:

```bash
./setup-secrets.sh
```

This creates three secrets:
- `itineraries-db-password` - For ItinerariesMS database connection
- `jwt-secret` - For TravelPlannerMS JWT token generation
- `google-client-id` - For OAuth2 login

**Manual secret creation** (if needed):
```bash
# Create itineraries database password
echo "Id@12345" | gcloud secrets create itineraries-db-password \
  --data-file=- --project=cloudnine-475221

# Create JWT secret
echo "your-jwt-secret-$(openssl rand -hex 32)" | gcloud secrets create jwt-secret \
  --data-file=- --project=cloudnine-475221

# Create Google Client ID
echo "641211583543-p7s4smapf77ublrhb2mp0ssjqpcmmc4e.apps.googleusercontent.com" | \
  gcloud secrets create google-client-id \
  --data-file=- --project=cloudnine-475221
```

### 2. Setup VM Environment

Installs required software on the microservice VM:

```bash
./setup-vm.sh
```

This installs:
- Node.js 20.x
- npm
- PM2 process manager
- Configures PM2 to start on boot

### 3. Configure OAuth (Optional)

If you need to set up or update OAuth configuration:

See [OAUTH_SETUP_GUIDE.md](OAUTH_SETUP_GUIDE.md) for detailed instructions.

## Service Deployment

### VM-Based Microservices

#### DestinationsMS

**Deploy to VM**:
```bash
cd DestinationsMS
./deploy-vm.sh
```

**What it does**:
1. Copies source code to microservice VM via `gcloud compute scp`
2. Copies `.env` file with database credentials
3. SSHs to VM and runs `npm ci && npm run build`
4. Starts/restarts service with PM2 on port 3001

**Environment variables** (.env):
```bash
PORT=3001
HOST=0.0.0.0
DB_HOST=34.55.101.72
DB_USER=destinations_user
DB_PASSWORD=Dd@12345
DB_NAME=destinations_db
ALLOWED_ORIGINS=*
```

#### PricingMS

**Deploy to VM**:
```bash
cd PricingMS
./deploy-vm.sh
```

**What it does**:
Same process as DestinationsMS, but for port 3002.

**Environment variables** (.env):
```bash
PORT=3002
HOST=0.0.0.0
DB_HOST=10.128.0.3
DB_USER=pricing_user
DB_PASSWORD=p123
DB_NAME=pricing_db
ALLOWED_ORIGINS=*
```

**Check VM services**:
```bash
# SSH to VM
gcloud compute ssh microservice --zone=us-central1-c \
  --ssh-key-file=$HOME/.ssh/databasesql

# Check PM2 status
pm2 status

# View logs
pm2 logs destinations-ms --lines 50
pm2 logs pricing-ms --lines 50

# Restart a service
pm2 restart destinations-ms
```

### Cloud Run Microservices

#### ItinerariesMS

**Deploy to Cloud Run**:
```bash
cd ItinerariesMS
./deploy.sh
```

**What it does**:
1. Builds Docker image using multi-stage Dockerfile
2. Pushes to Google Container Registry (gcr.io)
3. Deploys to Cloud Run with:
   - Cloud SQL socket connection (`/cloudsql/cloudnine-475221:us-central1:itineraries-db`)
   - Secrets from Secret Manager (database password)
   - Auto-scaling 0-10 instances
   - Port 8080 (Cloud Run default)

**View logs**:
```bash
# Stream logs
gcloud run services logs tail itineraries-ms --region us-central1

# Read recent logs
gcloud run services logs read itineraries-ms --region us-central1 --limit 50
```

#### TravelPlannerMS (API Gateway)

**Deploy to Cloud Run**:
```bash
cd TravelPlannerMS
./deploy.sh
```

**What it does**:
1. Builds and pushes Docker image
2. Deploys to Cloud Run with:
   - Downstream service URLs (DestinationsMS, PricingMS, ItinerariesMS)
   - Secrets from Secret Manager (Google Client ID, JWT secret)
   - Auto-scaling 0-10 instances

**Environment variables** (set in deploy.sh):
```bash
DESTINATIONS_MS_URL=http://136.113.150.64:3001
PRICING_MS_URL=http://136.113.150.64:3002
ITINERARIES_MS_URL=https://itineraries-ms-izocsrgyaq-uc.a.run.app
```

**Secrets** (from Secret Manager):
- `GOOGLE_CLIENT_ID` - OAuth2 client ID
- `JWT_SECRET` - JWT signing secret

### Frontend Deployment

**Deploy to Cloud Storage**:
```bash
cd Application
./deploy-updated.sh
```

**What it does**:
1. Uploads static files (HTML, CSS, JS) to Cloud Storage bucket
2. Sets cache control headers to `no-cache, no-store, must-revalidate`
3. Ensures public access (allUsers:objectViewer)

**Access URL**:
```
https://storage.googleapis.com/travel-planner-frontend-cloudnine/index.html
```

**Manual deployment** (if needed):
```bash
# Upload files
gsutil -m cp -r * gs://travel-planner-frontend-cloudnine/

# Set public access
gsutil iam ch allUsers:objectViewer gs://travel-planner-frontend-cloudnine

# Set cache headers
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" \
  gs://travel-planner-frontend-cloudnine/*
```

### Cloud Function Deployment

**Deploy event processor**:
```bash
cd CloudFunction
./deploy.sh
```

**What it does**:
1. Enables required APIs (cloudfunctions, cloudbuild, pubsub, eventarc)
2. Deploys Cloud Function Gen 2 with:
   - Runtime: nodejs20
   - Trigger: Pub/Sub topic `itinerary-events`
   - Region: us-central1
   - Memory: 256MB
   - Timeout: 60s

**Test function**:
```bash
# Publish test event
gcloud pubsub topics publish itinerary-events \
  --message='{"event_type":"itinerary_created","itinerary_id":"test-123","owner_user_id":"user-456","name":"Test Trip","timestamp":"2025-12-14T00:00:00Z"}'

# View logs
gcloud functions logs read processItineraryEvent \
  --region=us-central1 --gen2 --limit=20
```

## Database Deployment

### Important Notes

⚠️ **WARNING**: The `deploy-*.sh` scripts DROP and RECREATE databases!
- Only use for initial setup or complete rebuild
- For production updates, use `migrate-db.sh` instead

### Destinations Database (Cloud SQL)

**Deploy**:
```bash
cd Database
export DB_HOST=34.55.101.72
export DB_USER=root
export DB_PASSWORD=<your-cloud-sql-password>
./deploy-destinations-db.sh
```

**What it does**:
1. Connects to Cloud SQL instance
2. Drops and recreates `destinations_db`
3. Loads schema from `destinations_schema.sql`
4. Loads seed data from `destinations_seed.sql`

### Itineraries Database (Cloud SQL)

**Deploy**:
```bash
cd Database
export DB_HOST=136.119.166.207
export DB_USER=root
export DB_PASSWORD=<your-cloud-sql-password>
./deploy-itineraries-db.sh
```

### Pricing Database (VM MySQL)

**Deploy**:
```bash
cd Database
export DB_HOST=10.128.0.3
export DB_USER=root
export DB_PASSWORD=<your-vm-mysql-password>
./deploy-pricing-db.sh
```

### Safe Database Migration

For production updates without losing data:

```bash
cd Database

# 1. Create migration SQL file
# Example: migrations/001_add_column.sql

# 2. Run migration with automatic backup
export DB_HOST=34.55.101.72
export DB_USER=root
export DB_PASSWORD=<password>
./migrate-db.sh destinations_db migrations/001_add_column.sql

# Migration creates automatic backup:
# destinations_db_backup_YYYYMMDD_HHMMSS.sql
```

**Rollback from backup**:
```bash
mysql -h 34.55.101.72 -u root -p destinations_db < backup_file.sql
```

## Unified Redeployment Script

The `redeploy-all.sh` script provides quick redeployment of all services without database recreation.

**Usage**:
```bash
./redeploy-all.sh [--skip-vm] [--skip-cloudrun] [--skip-frontend] [--skip-function]
```

**What it does**:
1. Deploys VM-based services (DestinationsMS, PricingMS)
2. Deploys Cloud Run services (ItinerariesMS, TravelPlannerMS)
3. Deploys Frontend
4. Deploys Cloud Function
5. Verifies all health endpoints

**Options**:
- `--skip-vm` - Skip VM service deployment
- `--skip-cloudrun` - Skip Cloud Run service deployment
- `--skip-frontend` - Skip frontend deployment
- `--skip-function` - Skip Cloud Function deployment

**Example**:
```bash
# Redeploy everything
./redeploy-all.sh

# Redeploy only Cloud Run services and frontend
./redeploy-all.sh --skip-vm --skip-function
```

## Verification

### Health Checks

Test all service health endpoints:

```bash
# DestinationsMS
curl http://136.113.150.64:3001/health

# PricingMS
curl http://136.113.150.64:3002/health

# ItinerariesMS
curl https://itineraries-ms-izocsrgyaq-uc.a.run.app/health

# TravelPlannerMS
curl https://travel-planner-ms-izocsrgyaq-uc.a.run.app/health

# Frontend (check if file loads)
curl -I https://storage.googleapis.com/travel-planner-frontend-cloudnine/index.html
```

### VM Service Status

```bash
# SSH to VM
gcloud compute ssh microservice --zone=us-central1-c \
  --ssh-key-file=$HOME/.ssh/databasesql

# Check PM2 processes
pm2 status

# Expected output:
# ┌─────┬────────────────────┬─────────┬──────┐
# │ id  │ name               │ status  │ cpu  │
# ├─────┼────────────────────┼─────────┼──────┤
# │ 0   │ destinations-ms    │ online  │ 0%   │
# │ 1   │ pricing-ms         │ online  │ 0%   │
# └─────┴────────────────────┴─────────┴──────┘
```

### Cloud Run Services

```bash
# List all Cloud Run services
gcloud run services list --region us-central1

# Describe specific service
gcloud run services describe itineraries-ms --region us-central1
gcloud run services describe travel-planner-ms --region us-central1
```

### Database Connectivity

```bash
# Test Cloud SQL (destinations)
mysql -h 34.55.101.72 -u destinations_user -p -e "USE destinations_db; SELECT COUNT(*) FROM cities;"

# Test Cloud SQL (itineraries)
mysql -h 136.119.166.207 -u itineraries_user -p -e "USE itineraries_db; SELECT COUNT(*) FROM itineraries;"

# Test VM MySQL (pricing)
mysql -h 10.128.0.3 -u pricing_user -p -e "USE pricing_db; SELECT COUNT(*) FROM lodging_classes;"
```

### End-to-End Test

1. Open frontend: https://storage.googleapis.com/travel-planner-frontend-cloudnine/index.html
2. Sign in with Google
3. Browse destinations
4. Create a test itinerary
5. Check if data persists after refresh

## Rollback Procedures

### Rollback VM Services

**Automated rollback**:
```bash
./rollback-vm.sh
```

This interactive script:
1. Shows current PM2 processes
2. Prompts for service to rollback
3. Restarts the service
4. Shows recent logs

**Manual rollback**:
```bash
gcloud compute ssh microservice --zone=us-central1-c \
  --ssh-key-file=$HOME/.ssh/databasesql \
  --command="pm2 restart destinations-ms"
```

### Rollback Cloud Run Services

**Automated rollback**:
```bash
./rollback-cloudrun.sh
```

This interactive script:
1. Lists Cloud Run services
2. Shows available revisions
3. Prompts for revision to rollback to
4. Updates traffic routing
5. Verifies health

**Manual rollback**:
```bash
# List revisions
gcloud run revisions list \
  --service itineraries-ms \
  --region us-central1

# Rollback to specific revision
gcloud run services update-traffic itineraries-ms \
  --to-revisions <revision-name>=100 \
  --region us-central1
```

## Environment Configuration

### DestinationsMS (.env)
```env
PORT=3001
HOST=0.0.0.0
DB_HOST=34.55.101.72
DB_USER=destinations_user
DB_PASSWORD=Dd@12345
DB_NAME=destinations_db
ALLOWED_ORIGINS=*
```

### PricingMS (.env)
```env
PORT=3002
HOST=0.0.0.0
DB_HOST=10.128.0.3
DB_USER=pricing_user
DB_PASSWORD=p123
DB_NAME=pricing_db
ALLOWED_ORIGINS=*
```

### ItinerariesMS (Cloud Run env vars)
```env
PORT=8080  # Automatically set by Cloud Run
DB_HOST=/cloudsql/cloudnine-475221:us-central1:itineraries-db
DB_USER=itineraries_user
DB_NAME=itineraries_db
DB_PASSWORD=<from Secret Manager: itineraries-db-password>
```

### TravelPlannerMS (Cloud Run env vars)
```env
PORT=8080  # Automatically set by Cloud Run
DESTINATIONS_MS_URL=http://136.113.150.64:3001
PRICING_MS_URL=http://136.113.150.64:3002
ITINERARIES_MS_URL=https://itineraries-ms-izocsrgyaq-uc.a.run.app
GOOGLE_CLIENT_ID=<from Secret Manager: google-client-id>
JWT_SECRET=<from Secret Manager: jwt-secret>
```

## Troubleshooting

### VM Service Won't Start

**Symptoms**: PM2 shows service as stopped or errored.

**Diagnosis**:
```bash
# Check PM2 logs
gcloud compute ssh microservice --zone=us-central1-c \
  --ssh-key-file=$HOME/.ssh/databasesql \
  --command="pm2 logs destinations-ms --lines 100"

# Check if port is in use
gcloud compute ssh microservice --zone=us-central1-c \
  --ssh-key-file=$HOME/.ssh/databasesql \
  --command="sudo netstat -tulpn | grep :3001"
```

**Solutions**:
1. Check `.env` file exists and has correct values
2. Verify database connectivity
3. Check Node.js version: `node --version` (should be 20+)
4. Restart service: `pm2 restart destinations-ms`
5. Delete and redeploy: `pm2 delete destinations-ms && ./deploy-vm.sh`

### Cloud Run Deployment Fails

**Symptoms**: Deployment hangs or fails with build errors.

**Diagnosis**:
```bash
# Check recent Cloud Build logs
gcloud builds list --limit 5

# View specific build
gcloud builds log <build-id>

# Check service status
gcloud run services describe itineraries-ms --region us-central1
```

**Common issues**:
1. **Docker build fails**: Check Dockerfile syntax, missing dependencies
2. **Secret access denied**: Grant Secret Manager Secret Accessor role:
   ```bash
   gcloud secrets add-iam-policy-binding <secret-name> \
     --member="serviceAccount:641211583543-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```
3. **Cloud SQL connection fails**: Verify instance connection name is correct
4. **Out of memory**: Increase Cloud Run memory limit in deploy script

### Database Connection Issues

**Symptoms**: Services can't connect to database.

**Diagnosis**:
```bash
# Test connectivity
mysql -h 34.55.101.72 -u root -p -e "SELECT 1"

# Check Cloud SQL instances
gcloud sql instances list

# Describe instance
gcloud sql instances describe destinations-db
```

**Solutions**:
1. **Cloud SQL**: Check authorized networks, verify public IP enabled
2. **VM MySQL**: Check if MySQL service is running
3. **Credentials**: Verify username/password are correct
4. **Network**: Ensure firewall rules allow connections
5. **Cloud Run**: Verify `--add-cloudsql-instances` flag is set correctly

### Frontend Not Loading

**Symptoms**: 404 errors or blank page.

**Diagnosis**:
```bash
# Check bucket contents
gsutil ls -L gs://travel-planner-frontend-cloudnine/

# Check file permissions
gsutil iam get gs://travel-planner-frontend-cloudnine/

# Test file access
curl -I https://storage.googleapis.com/travel-planner-frontend-cloudnine/index.html
```

**Solutions**:
1. Verify bucket exists and has public access
2. Check cache headers: `Cache-Control: no-cache, no-store, must-revalidate`
3. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
4. Check browser console for JavaScript errors
5. Verify API URLs in `app.js` are correct

### OAuth Authentication Fails

**Symptoms**: "Failed to login" or "invalid_client" errors.

**Diagnosis**:
1. Check browser console for exact error message
2. Verify Google Client ID in `auth.js` matches OAuth client
3. Check OAuth consent screen has test users added
4. Verify authorized JavaScript origins include `https://storage.googleapis.com`

**Solutions**:
See [OAUTH_SETUP_GUIDE.md](OAUTH_SETUP_GUIDE.md) for detailed troubleshooting.

Key points:
1. Client ID must match in frontend and Secret Manager
2. For Google Identity Services, DO NOT set redirect URIs
3. Only set JavaScript origins: `https://storage.googleapis.com`
4. Wait 5-10 minutes after OAuth changes for propagation

### PM2 Not Loading .env File

**Symptoms**: Service starts but environment variables are missing.

**Solution**:
The deploy script explicitly loads environment variables before starting PM2:
```bash
pm2 start dist/server.js \
  --name pricing-ms \
  --env-file .env \
  --update-env
```

If issues persist, set variables directly:
```bash
pm2 start dist/server.js \
  --name pricing-ms \
  -- --PORT=3002 --DB_HOST=10.128.0.3
```

## Deployment Order

**Only relevant for first-time/full deployments.**

For optimal first-time deployment:

1. **Databases** - Deploy all databases first (one-time setup)
2. **VM Services** - Deploy DestinationsMS and PricingMS
3. **ItinerariesMS** - Deploy to Cloud Run
4. **TravelPlannerMS** - Deploy gateway (needs all backend services)
5. **Frontend** - Deploy last
6. **CloudFunction** - Deploy event processor

**For iterative deployments**: Deploy services in any order as dependencies are already established.

## Success Checklist

After deployment, verify:

- [ ] All databases are accessible and contain seed data
- [ ] DestinationsMS responds at http://136.113.150.64:3001/health
- [ ] PricingMS responds at http://136.113.150.64:3002/health
- [ ] ItinerariesMS Cloud Run service is healthy
- [ ] TravelPlannerMS Cloud Run service is healthy
- [ ] Frontend loads from Cloud Storage
- [ ] PM2 shows both VM services as "online"
- [ ] No errors in Cloud Run logs
- [ ] OAuth authentication works
- [ ] End-to-end flow works: login → browse → create itinerary

## Additional Resources

- [README.md](README.md) - Project overview
- [RESOURCE_SUMMARY.md](RESOURCE_SUMMARY.md) - GCP resource inventory
- [OAUTH_SETUP_GUIDE.md](OAUTH_SETUP_GUIDE.md) - OAuth configuration
- [Database/README.md](Database/README.md) - Database documentation
- Individual service READMEs for API documentation
