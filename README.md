NewsWatch

Monitor online news sources and produce a daily newsletter every morning containing interesting software economy developments relevant to investors and to CTOs.

## Features

### User Features

- **Daily Newsletter Delivery**: Receive a curated newsletter every morning containing the most relevant software economy developments for investors and CTOs.
- **Community-Curated Coverage**: Access a single, non-personalized view of the most interesting news articles, designed to counter the 'tunnel vision' of seeing news only from your favorite sources.
- **Article Voting**: Vote on articles using a simple thumbs-up or thumbs-down mechanism. Vote counts are updated on the static website hourly.
- **Individual Article Summaries**: View detailed summaries and private equity impact analysis for each article.
- **Newsletter Archive**: Browse past issues and go back to view previous newsletters at any time.

### Administrator Features

- **Automated News Monitoring**: Continuously monitor online news sources with credibility tracking based on user feedback.
- **AI-Powered PE Analysis**: Analyze news articles for private equity impact using AI-powered insights.
- **Unified Guidance Document**: View and edit a centralized guidance document that incorporates all user feedback to shape future coverage, including source credibility, subject importance, and editorial style.
- **Token Cost Tracking**: Monitor AI usage costs with a token tracking system. Each newsletter displays its generation cost (e.g., 'COST 5K TOKENS') by recording every insight generation in the database.
- **Static Site Generation**: All content is delivered via static files to minimize hosting costs. The system runs hourly to check for new articles, analyze them, and update the static website.

## User Feedback Process

NewsWatch implements a comprehensive feedback loop to continuously improve coverage:

1. **Collecting Feedback**: Community members can provide feedback through the voting system (thumbs up/down) and direct text feedback on articles.
2. **Analyzing Feedback**: The system interprets feedback as a human editor would, considering:
   - Source credibility adjustments based on user preferences
   - Subject interest rankings to prioritize certain topics
   - Editorial guidance on depth of coverage and writing style
3. **Incorporating Feedback**: All feedback is compiled into a unified guidance document that shapes future coverage. Each person who submits feedback receives an updated newsletter reflecting their input.

## Deployment

### GCP Cloud Run and Firestore (Free Tier)

The system is designed to run on Google Cloud Platform under the free tier, using Cloud Run and Firestore.

#### Free Tier Limits

> **Note**: Check the [Google Cloud Free Tier page](https://cloud.google.com/free) for the latest limits.

- **Cloud Run**: 2 million requests/month, 360,000 GB-seconds of memory, 180,000 vCPU-seconds
- **Firestore**: 1 GB storage, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day

#### Quick Setup

1. **Prerequisites**:
   - Install [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
   - Create a GCP project and enable billing (required even for free tier)
   - Enable Cloud Run and Firestore APIs

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy newswatch \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --memory 256Mi \
     --cpu 1
   ```

4. **Set Up Firestore**:
   - Navigate to Firebase Console > Firestore Database
   - Create a database in Native mode
   - Select a region close to your Cloud Run instance

5. **Configure Scheduled Jobs**:
   
   Replace `YOUR_CLOUD_RUN_URL` with the Service URL shown in the output of the `gcloud run deploy` command (e.g., `https://newswatch-abc123-uc.a.run.app`).
   
   ```bash
   # Set up Cloud Scheduler for hourly news ingestion
   gcloud scheduler jobs create http newswatch-ingest \
     --schedule "0 * * * *" \
     --uri "YOUR_CLOUD_RUN_URL/api/ingest" \
     --http-method POST

   # Set up Cloud Scheduler for daily newsletter
   gcloud scheduler jobs create http newswatch-newsletter \
     --schedule "0 6 * * *" \
     --uri "YOUR_CLOUD_RUN_URL/api/newsletter/send" \
     --http-method POST \
     --time-zone "America/New_York"
   ```

For detailed local deployment instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Branch Notes

> **Note**: The `claude/research-hosting-costs` branch contains experimental research into hosting cost optimizations and is not intended for production use. Documentation in that branch may be sparse or incomplete as it serves as a working area for cost analysis and infrastructure experiments.
