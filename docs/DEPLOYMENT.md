# NewsWatch Deployment Guide

## Quick Local Deployment

### Option 1: Automated Script (Recommended)

```bash
# Run the deployment script
./deploy.sh
```

This script will:

1. Start PostgreSQL (requires sudo password)
2. Create `newswatch` database
3. Run schema migrations
4. Seed with sample data
5. Start the backend server on port 3000

---

### Option 2: Manual Step-by-Step

#### 1. Start PostgreSQL

```bash
# Start PostgreSQL service
sudo systemctl start postgresql

# Verify it's running
pg_isready
# Should output: /run/postgresql:5432 - accepting connections
```

#### 2. Create Database

```bash
# Create the database
createdb newswatch

# Verify it was created
psql -l | grep newswatch
```

#### 3. Run Schema

```bash
# Apply database schema
psql -d newswatch -f backend/database/schema.sql

# Verify tables were created
psql -d newswatch -c "\dt"
```

#### 4. Seed Sample Data

```bash
# Add sample stories
npm run db:seed

# Verify data was inserted
psql -d newswatch -c "SELECT COUNT(*) FROM stories;"
```

#### 5. Start Backend Server

```bash
# Development mode (with auto-reload)
npm run dev

# Or production mode
npm start
```

Server will start on **<http://localhost:3000>**

---

## Verify Deployment

### Test API Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Get stories
curl http://localhost:3000/api/stories/top/newsletter

# Generate newsletter (manual trigger)
curl -X POST http://localhost:3000/api/newsletter/send
```

### View Newsletter Preview

After generating a newsletter, open:

```bash
open newsletter-preview.html
# Or: xdg-open newsletter-preview.html
```

### Access Frontend

Open in browser:

```
file:///home/laird/src/NewsWatch/index.html
```

---

## Configuration

### Environment Variables

Edit `backend/.env`:

```bash
# Required
DATABASE_URL=postgresql://localhost:5432/newswatch

# Optional (for production features)
OPENAI_API_KEY=sk-...              # For real PE analysis
SENDGRID_API_KEY=SG...             # For email sending
EMAIL_FROM=newsletter@newswatch.app
ADMIN_EMAIL=admin@newswatch.app

# Server
PORT=3000
NODE_ENV=development

# Newsletter Schedule
NEWSLETTER_SEND_TIME=06:00
NEWSLETTER_TIMEZONE=America/New_York
```

---

## Production Deployment

### Option 1: Railway (Easiest)

1. **Sign up**: <https://railway.app>
2. **Create new project** from GitHub
3. **Add PostgreSQL**: Railway → Add Service → PostgreSQL
4. **Set environment variables**:
   - `DATABASE_URL` (auto-set by Railway)
   - `OPENAI_API_KEY`
   - `SENDGRID_API_KEY`
   - `EMAIL_FROM`
   - `NODE_ENV=production`
5. **Deploy**: Push to GitHub → Railway auto-deploys

**Cost**: ~$10-20/month

---

### Option 2: Render

1. **Sign up**: <https://render.com>
2. **Create PostgreSQL database**
3. **Create Web Service** from GitHub
4. **Set environment variables**
5. **Deploy**

**Cost**: Free tier available, ~$7/month for production

---

### Option 3: AWS (Advanced)

**Components needed:**

- **RDS PostgreSQL** - Managed database
- **ECS or EC2** - Backend server
- **EventBridge** - Cron scheduling
- **SES** - Email sending

**Cost**: ~$30-50/month (more scalable)

---

## Troubleshooting

### PostgreSQL won't start

```bash
# Check status
sudo systemctl status postgresql

# View logs
sudo journalctl -u postgresql -n 50

# Restart
sudo systemctl restart postgresql
```

### Database connection errors

```bash
# Check if database exists
psql -l | grep newswatch

# Check connection string
echo $DATABASE_URL

# Test connection
psql -d newswatch -c "SELECT 1;"
```

### Port 3000 already in use

```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### Schema errors

```bash
# Drop and recreate database
dropdb newswatch
createdb newswatch
psql -d newswatch -f backend/database/schema.sql
```

---

## Monitoring

### View Logs

```bash
# Backend server logs (if running with npm start)
# Logs appear in terminal

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Check Scheduled Tasks

The backend logs will show:

```
⏰ Initializing scheduler...
  ✓ Newsletter scheduled for 06:00 daily (America/New_York)
  ✓ News ingestion scheduled hourly
```

### Database Queries

```bash
# View all stories
psql -d newswatch -c "SELECT headline, pe_impact_score FROM stories ORDER BY pe_impact_score DESC LIMIT 10;"

# View feedback
psql -d newswatch -c "SELECT * FROM feedback ORDER BY submitted_at DESC LIMIT 10;"

# View newsletters sent
psql -d newswatch -c "SELECT * FROM newsletters ORDER BY date DESC LIMIT 5;"
```

---

## Next Steps After Deployment

1. **Test the full flow**:
   - Backend API responds
   - Stories are ingested
   - PE analysis works
   - Newsletter generates

2. **Add real API keys**:
   - OpenAI for real PE analysis
   - SendGrid for email sending

3. **Configure news sources**:
   - Edit `backend/services/newsIngestion.js`
   - Add RSS feeds you want to monitor

4. **Add subscribers**:

   ```sql
   INSERT INTO subscribers (email, name) 
   VALUES ('your@email.com', 'Your Name');
   ```

5. **Test newsletter send**:

   ```bash
   curl -X POST http://localhost:3000/api/newsletter/send
   ```

6. **Deploy to production** (Railway/Render/AWS)

---

## Automated Tasks

Once deployed, the system runs automatically:

- **Every hour**: Ingest news from RSS feeds
- **Every day at 6 AM**: Generate and send newsletter
- **Continuously**: Analyze new stories for PE impact

No manual intervention needed! 🎉
