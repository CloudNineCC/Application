# Travel Planner - Cloud-Native Microservices Application

A full-stack travel planning application built with a microservices architecture on Google Cloud Platform. Users can browse destinations, create itineraries, and get pricing quotes for their trips.

## Project Overview

This is a production-ready cloud-native application demonstrating:
- **Microservices Architecture**: Independent, scalable services with clear boundaries
- **Hybrid Cloud Deployment**: Mix of VM-based and Cloud Run services
- **Event-Driven Architecture**: Pub/Sub for asynchronous processing
- **OAuth2 Authentication**: Google Sign-In integration
- **Database Strategy**: Cloud SQL and VM-based MySQL
- **Static Website Hosting**: Cloud Storage for frontend

## Architecture

### Services

| Service | Type | Port/URL | Purpose |
|---------|------|----------|---------|
| **DestinationsMS** | VM (Compute Engine) | 3001 | Manages cities and travel seasons |
| **PricingMS** | VM (Compute Engine) | 3002 | Handles pricing, rates, and quotes |
| **ItinerariesMS** | Cloud Run | [URL](https://itineraries-ms-izocsrgyaq-uc.a.run.app) | Manages user itineraries and collaboration |
| **TravelPlannerMS** | Cloud Run (API Gateway) | [URL](https://travel-planner-ms-izocsrgyaq-uc.a.run.app) | Aggregates data from all services |
| **Frontend** | Cloud Storage | [URL](https://storage.googleapis.com/travel-planner-frontend-cloudnine/index.html) | Static web application |
| **CloudFunction** | Cloud Functions | Event-driven | Processes itinerary creation events |

### Databases

| Database | Type | Used By |
|----------|------|---------|
| `destinations_db` | Cloud SQL MySQL | DestinationsMS |
| `itineraries_db` | Cloud SQL MySQL | ItinerariesMS |
| `pricing_db` | VM MySQL | PricingMS |

### System Diagram

```
┌─────────────┐
│   Browser   │
│  (OAuth2)   │
└──────┬──────┘
       │
       ↓
┌─────────────────────────┐
│  Frontend               │
│  (Cloud Storage)        │
└───────┬─────────────────┘
        │
    ┌───┴───┐
    │       │
    ↓       ↓
┌────────────┐  ┌──────────────┐
│TravelPlanner│  │ItinerariesMS │
│MS (Gateway)│  │(Cloud Run)   │──→ Pub/Sub ──→ Cloud Function
└─┬──┬──┬────┘  └──────────────┘
  │  │  │
  ↓  ↓  ↓
┌──┐┌──┐┌──┐
│D ││P ││I │  (Destinations, Pricing, Itineraries)
│B ││B ││B │  (Cloud SQL + VM MySQL)
└──┘└──┘└──┘
```

## Quick Start

### Prerequisites

- Google Cloud Platform account
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and configured
- Node.js 20+ and npm
- MySQL client (for database setup)

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Project
   ```

2. **Configure secrets**
   ```bash
   ./setup-secrets.sh
   ```

3. **Setup VM environment**
   ```bash
   ./setup-vm.sh
   ```

4. **Deploy all services**
   ```bash
   ./deploy-all.sh
   ```

### Iterative Deployment

For code updates to individual services:

```bash
# Update DestinationsMS or PricingMS
cd DestinationsMS  # or PricingMS
./deploy-vm.sh

# Update ItinerariesMS or TravelPlannerMS
cd ItinerariesMS  # or TravelPlannerMS
./deploy.sh

# Update Frontend
cd Application
./deploy-updated.sh

# Update Cloud Function
cd CloudFunction
./deploy.sh
```

## Repository Structure

```
Project/
├── Application/           # Frontend (HTML, CSS, JS)
├── DestinationsMS/       # Destinations microservice
├── PricingMS/            # Pricing microservice
├── ItinerariesMS/        # Itineraries microservice
├── TravelPlannerMS/      # API Gateway service
├── CloudFunction/        # Event processing function
├── Database/             # Database schemas and deployment scripts
├── deploy-all.sh         # Master deployment script
├── setup-secrets.sh      # Configure Google Secret Manager
├── setup-vm.sh           # Setup VM environment
├── rollback-vm.sh        # Rollback VM services
└── rollback-cloudrun.sh  # Rollback Cloud Run services
```

## Service Documentation

Each service has its own README with setup and development instructions:
- [Application/README.md](Application/README.md) - Frontend setup and development
- [DestinationsMS/README.md](DestinationsMS/README.md) - Destinations service
- [PricingMS/README.md](PricingMS/README.md) - Pricing service
- [ItinerariesMS/README.md](ItinerariesMS/README.md) - Itineraries service
- [TravelPlannerMS/README.md](TravelPlannerMS/README.md) - API Gateway
- [CloudFunction/README.md](CloudFunction/README.md) - Cloud Function
- [Database/README.md](Database/README.md) - Database setup and management

## Deployment Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Comprehensive deployment guide
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - Latest deployment status
- [RESOURCE_SUMMARY.md](RESOURCE_SUMMARY.md) - GCP resource inventory
- [OAUTH_SETUP_GUIDE.md](OAUTH_SETUP_GUIDE.md) - OAuth configuration

## Key Features

### Frontend
- Google OAuth2 authentication
- Browse destinations with seasonal information
- Create and manage itineraries
- Multi-user collaboration
- Budget tracking

### Backend
- RESTful APIs with HATEOAS principles
- JWT-based authentication
- ETag support for optimistic concurrency
- Async job processing for bulk operations
- Composite endpoints for data aggregation
- Worker threads for parallel data fetching

### Infrastructure
- Auto-scaling Cloud Run services (0-10 instances)
- PM2 process management for VM services
- Cloud SQL with automatic backups
- Pub/Sub for event-driven processing
- Secret Manager for secure credential storage
- Multi-stage Docker builds for optimized images

## Technology Stack

### Frontend
- Vanilla JavaScript, HTML5, CSS3
- Google Identity Services (OAuth2)
- JWT token management

### Backend
- Node.js 20, TypeScript
- Express.js web framework
- MySQL (mysql2 driver)
- PM2 process manager
- Docker (Alpine-based images)

### Cloud Services
- Google Compute Engine (VMs)
- Google Cloud Run (Serverless containers)
- Google Cloud SQL (MySQL)
- Google Cloud Storage (Static hosting)
- Google Cloud Functions (Event processing)
- Google Pub/Sub (Event messaging)
- Google Secret Manager (Credentials)

## Development

### Local Development Setup

See individual service READMEs for local development instructions. Generally:

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` (if applicable)
3. Configure database connection
4. Run development server: `npm run dev`
5. Run tests: `npm test`

### Testing Endpoints

```bash
# Health checks
curl http://136.113.150.64:3001/health  # DestinationsMS
curl http://136.113.150.64:3002/health  # PricingMS
curl https://itineraries-ms-izocsrgyaq-uc.a.run.app/health
curl https://travel-planner-ms-izocsrgyaq-uc.a.run.app/health

# API examples (see individual service docs for full API)
curl http://136.113.150.64:3001/api/cities
curl http://136.113.150.64:3002/api/lodging-classes
```

## Monitoring & Operations

### View Service Logs

```bash
# VM services
gcloud compute ssh microservice --zone=us-central1-c --command="pm2 logs"

# Cloud Run services
gcloud run services logs tail itineraries-ms --region us-central1
gcloud run services logs tail travel-planner-ms --region us-central1

# Cloud Function
gcloud functions logs read processItineraryEvent --region=us-central1 --gen2
```

### Check Service Status

```bash
# VM services
gcloud compute ssh microservice --zone=us-central1-c --command="pm2 status"

# Cloud Run services
gcloud run services list --region us-central1

# Databases
gcloud sql instances list
```

### Rollback Procedures

```bash
# Rollback VM services
./rollback-vm.sh

# Rollback Cloud Run services
./rollback-cloudrun.sh
```

## Security Best Practices

1. **Secrets Management**: All sensitive credentials stored in Secret Manager
2. **Environment Variables**: Never commit `.env` files (already in `.gitignore`)
3. **OAuth Configuration**: Use separate client IDs for dev/prod
4. **CORS**: Currently set to `*` for development - restrict in production
5. **Database Access**: Separate users per service with limited privileges
6. **IAM Permissions**: Service accounts follow least-privilege principle
7. **Firewall Rules**: Only necessary ports exposed on VMs

## Contributing

1. Make changes to the appropriate service
2. Test locally
3. Deploy to GCP using service-specific deploy script
4. Verify health endpoints and logs
5. Test end-to-end functionality

## Troubleshooting

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed troubleshooting steps.

Common issues:
- **VM service won't start**: Check PM2 logs and environment variables
- **Cloud Run deployment fails**: Check Cloud Build logs
- **Database connection issues**: Verify credentials and network access
- **OAuth errors**: Verify client ID and authorized origins/redirects

## Project Information

- **Project ID**: cloudnine-475221
- **Region**: us-central1
- **VM Zone**: us-central1-c
- **Database Zone**: us-central1-c (Cloud SQL), us-central1-a (VM MySQL)

## Support

For issues or questions:
1. Check service-specific README files
2. Review [DEPLOYMENT.md](DEPLOYMENT.md) troubleshooting section
3. Check service logs using commands above
4. Verify all prerequisites are met

## License

[Add your license here]
