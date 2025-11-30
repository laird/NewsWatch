# NewsWatch

AI-powered private equity news analysis and newsletter service.

## Overview

NewsWatch ingests news from multiple sources, analyzes each story's impact on private equity using AI, and delivers daily newsletters to subscribers. The system uses Google Cloud Firestore for data storage and can run locally with the Firestore emulator or in production on GCP Cloud Run.

## Quick Start

### Prerequisites

- Node.js 20+ LTS
- Firebase CLI (`npm install -g firebase-tools`)
- For GCP deployment: `gcloud` CLI and authenticated account

### Local Development

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/laird/NewsWatch.git
   cd NewsWatch
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your API keys
   ```

3. **Start local environment:**

   ```bash
   ./deploy.sh local
   ```

   This will:
   - Start Firestore emulator on port 8080
   - Start backend API on port 3000
   - Open emulator UI at <http://localhost:4000>

### Manual Local Setup

If you prefer to run services separately:

```bash
# Terminal 1: Start Firestore emulator
npm run emulator

# Terminal 2: Start backend server
npm start
```

## Deployment

### Using the Deployment Script

The `deploy.sh` script handles all deployment scenarios:

```bash
# Local development
./deploy.sh local

# Build Docker image
./deploy.sh build

# Deploy to GCP Cloud Run
./deploy.sh deploy

# Run tests
./deploy.sh test

# Show help
./deploy.sh help
```

### Manual GCP Deployment

1. **Authenticate with GCP:**

   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Ensure secrets exist in Secret Manager:**

   ```bash
   # Create secrets (one-time setup)
   echo -n "your-openai-key" | gcloud secrets create openai-api-key --data-file=-
   echo -n "your-gmail-secret" | gcloud secrets create gmail-client-secret --data-file=-
   echo -n "your-refresh-token" | gcloud secrets create gmail-refresh-token --data-file=-
   ```

3. **Deploy:**

   ```bash
   gcloud builds submit --config cloudbuild.yaml .
   ```

## Configuration

### Environment Variables

Create `backend/.env` for local development:

```bash
# GCP Configuration
GCP_PROJECT_ID=newswatch-local
FIRESTORE_EMULATOR_HOST=localhost:8080  # Comment out for production

# AI Configuration
AI_PROVIDER=openai
AI_MODEL=gpt-4o-2024-11-20
OPENAI_API_KEY=your-key-here

# Email Configuration
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
EMAIL_FROM=newsletter@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com

# Newsletter Settings
NEWSLETTER_SEND_TIME=06:00
NEWSLETTER_TIMEZONE=America/New_York
SHOW_GUIDANCE_IN_NEWSLETTER=true
```

### Production Configuration

Production environment variables are set in `cloudbuild.yaml` and secrets are managed via GCP Secret Manager.

## Architecture

- **Backend**: Node.js/Express API server
- **Database**: Google Cloud Firestore (or local emulator)
- **AI**: OpenAI GPT-4 for news analysis
- **Email**: Gmail API for newsletter delivery
- **Hosting**: GCP Cloud Run (production)
- **Scheduling**: GCP Cloud Scheduler for automated tasks

## API Endpoints

- `GET /health` - Health check
- `GET /api/stories` - Get analyzed stories
- `POST /api/newsletter/send` - Send newsletter
- `POST /api/feedback` - Submit feedback
- `GET /api/subscribers` - List subscribers
- `POST /api/reanalyze` - Reanalyze stories

## Scheduled Tasks

The following Cloud Scheduler jobs run in production:

- **site-generation**: Hourly site regeneration
- **daily-newsletter**: Daily newsletter at 6 AM EST

## Development Workflow

1. Make changes locally
2. Test with local emulator: `./deploy.sh local`
3. Run tests: `./deploy.sh test`
4. Commit changes: `git commit -am "description"`
5. Push to GitHub: `git push`
6. Deploy to production: `./deploy.sh deploy`

## Troubleshooting

### Local Development

**Emulator won't start:**

```bash
# Kill any existing processes
pkill -f firebase
pkill -f node

# Restart
./deploy.sh local
```

**Port already in use:**

```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm start
```

### Production Deployment

**Build fails:**

- Check `gcloud auth list` - ensure you're authenticated
- Verify project ID: `gcloud config get-value project`
- Check Cloud Build logs in GCP Console

**Service won't start:**

- Check Cloud Run logs: `gcloud logging read "resource.type=cloud_run_revision"`
- Verify secrets exist: `gcloud secrets list`
- Check environment variables in Cloud Run console

## Project Structure

```
NewsWatch/
├── backend/
│   ├── database/
│   │   └── firestore.js       # Firestore database layer
│   ├── routes/                # API route handlers
│   ├── services/              # Business logic
│   │   ├── newsIngestion.js   # RSS feed processing
│   │   ├── peAnalysis.js      # AI analysis
│   │   └── newsletter.js      # Email generation
│   └── server.js              # Express app
├── public/                    # Static frontend files
├── scripts/                   # Utility scripts
├── deploy.sh                  # Deployment script
├── cloudbuild.yaml           # GCP Cloud Build config
├── Dockerfile                # Container definition
└── firebase.json             # Emulator configuration
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT
