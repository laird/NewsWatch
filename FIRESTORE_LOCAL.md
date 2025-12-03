# Firestore Local Development Setup

## Quick Start (No GCP Required!)

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Start Firestore Emulator

```bash
# In one terminal
npm run emulator

# This will start:
# - Firestore Emulator on http://localhost:8080
# - Emulator UI on http://localhost:4000
```

### 3. Start the NewsWatch Backend

```bash
# In another terminal
npm start
```

The app will automatically connect to the local Firestore emulator (see `FIRESTORE_EMULATOR_HOST` in `.env`).

## Testing

```bash
# Health check
curl http://localhost:3000/health

# Generate invitation codes
curl -X POST http://localhost:3000/api/subscribers/invite/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 5}'

# Check stories (will be empty until ingestion runs)
curl http://localhost:3000/api/stories
```

## Viewing Data

Open the Emulator UI at **<http://localhost:4000>** to:

- Browse Firestore collections
- View documents  
- Manually add/edit/delete data
- See real-time API requests

## Switching to GCP Firestore

When ready to deploy, comment out `FIRESTORE_EMULATOR_HOST` in `.env` and set up GCP:

```bash
# Comment this line in .env:
# FIRESTORE_EMULATOR_HOST=localhost:8080

# Set GCP project:
GCP_PROJECT_ID=newswatch-prod

# Set credentials:
export GOOGLE_APPLICATION_CREDENTIALS=~/newswatch-key.json
```

## Benefits of Local Emulator

- ✅ **No GCP account needed** for development
- ✅ **Free** - no costs for development
- ✅ **Fast** - runs locally
- ✅ **Offline** - works without internet
- ✅ **Reset anytime** - restart emulator to clear all data
- ✅ **No quotas** - unlimited reads/writes locally

## Emulator vs Production

| Feature | Emulator | Production |
|---------|----------|------------|
| Cost | Free | Free tier then $$$|
| Speed | Fast (local) | Network latency |
| Data persistence | Lost on restart | Permanent |
| UI | localhost:4000 | Firebase Console |
| Authentication | None needed | Service account |
