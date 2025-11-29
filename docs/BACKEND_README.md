# NewsWatch Backend

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

### 3. Set Up Database

```bash
# Create PostgreSQL database
createdb newswatch

# Run schema
npm run db:setup
```

### 4. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

## API Endpoints

### Feedback

- `POST /api/feedback` - Submit story feedback
- `GET /api/feedback/stats/:storyId` - Get feedback stats
- `GET /api/feedback/all` - Get all feedback (admin)

### Stories

- `GET /api/stories` - Get all stories
- `GET /api/stories/:id` - Get single story
- `GET /api/stories/top/newsletter` - Get top stories for newsletter
- `POST /api/stories/:id/analyze` - Analyze story for PE impact

### Newsletter

- `GET /api/newsletter/latest` - Get latest newsletter
- `GET /api/newsletter/history` - Get newsletter history
- `POST /api/newsletter/send` - Send newsletter now (manual trigger)

## Automated Tasks

- **Daily Newsletter**: Sends at 6:00 AM (configurable via `NEWSLETTER_SEND_TIME`)
- **News Ingestion**: Runs hourly to fetch new stories from RSS feeds

## Configuration

Edit `backend/.env`:

```bash
# Database
DATABASE_URL=postgresql://localhost:5432/newswatch

# OpenAI (optional - uses mock analysis if not set)
OPENAI_API_KEY=sk-...

# Email (optional - logs to console if not set)
SENDGRID_API_KEY=SG...
EMAIL_FROM=newsletter@newswatch.local

# Server
PORT=3000
NODE_ENV=development

# Newsletter
NEWSLETTER_SEND_TIME=06:00
NEWSLETTER_TIMEZONE=America/New_York
```

## Development Mode

Without API keys, the system will:

- Use **mock PE analysis** (keyword-based scoring)
- **Log emails** to console and save HTML to `newsletter-preview.html`
- Still collect feedback and manage stories

## Testing

### Test Feedback API

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"storyId":"123","rating":"up","text":"Great story!"}'
```

### Test Newsletter Send

```bash
curl -X POST http://localhost:3000/api/newsletter/send
```

### View Stories

```bash
curl http://localhost:3000/api/stories/top/newsletter
```

## Production Deployment

1. Set up managed PostgreSQL database
2. Configure environment variables
3. Set up SendGrid or email service
4. Add OpenAI API key for real analysis
5. Deploy to Railway, Render, or AWS

## Next Steps

- [ ] Add authentication for admin endpoints
- [ ] Implement subscriber management UI
- [ ] Add email tracking (opens, clicks)
- [ ] Create admin dashboard
- [ ] Add more news sources
- [ ] Implement feedback learning algorithm
