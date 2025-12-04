const { Firestore } = require('@google-cloud/firestore');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Initialize Firestore
// In production on GCP, credentials are auto-detected
// For local development, set FIRESTORE_EMULATOR_HOST env var or it will auto-detect
const firestoreConfig = {
    projectId: process.env.GCP_PROJECT_ID || 'newswatch-local',
};

// For local development with emulator
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.NODE_ENV === 'development') {
    // Emulator will be auto-detected if FIRESTORE_EMULATOR_HOST is set
    // Default to localhost:8080 if in development mode
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
        process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    }
    console.log(`🔧 Using Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
}

const db = new Firestore(firestoreConfig);

// Collection references
const collections = {
    stories: db.collection('stories'),
    feedback: db.collection('feedback'),
    newsletters: db.collection('newsletters'),
    subscribers: db.collection('subscribers'),
    invitations: db.collection('invitations'),
    sourceQuality: db.collection('source_quality')
};

// Helper to generate UUID
function generateId() {
    return uuidv4();
}

// Helper to convert Firestore doc to plain object with id
function docToObject(doc) {
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

// Helper to convert query snapshot to array
function snapshotToArray(snapshot) {
    const results = [];
    snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
    });
    return results;
}

// Stories collection helpers
const stories = {
    async getAll({ limit = 20, offset = 0, minPEScore = 0 } = {}) {
        // Fetch more to account for potential duplicates
        const fetchLimit = limit + 10;

        let query = collections.stories
            .where('pe_impact_score', '>=', minPEScore)
            .orderBy('pe_impact_score', 'desc')
            .orderBy('ingested_at', 'desc')
            .limit(fetchLimit);

        if (offset > 0) {
            query = collections.stories
                .where('pe_impact_score', '>=', minPEScore)
                .orderBy('pe_impact_score', 'desc')
                .orderBy('ingested_at', 'desc')
                .limit(offset + fetchLimit);
            const snapshot = await query.get();
            const allResults = snapshotToArray(snapshot);
            // Filter duplicates
            const activeResults = allResults.filter(s => !s.is_duplicate);
            return activeResults.slice(offset, offset + limit);
        }

        const snapshot = await query.get();
        const allResults = snapshotToArray(snapshot);
        // Filter duplicates
        const activeResults = allResults.filter(s => !s.is_duplicate);
        return activeResults.slice(0, limit);
    },

    async getById(id) {
        const doc = await collections.stories.doc(id).get();
        return docToObject(doc);
    },

    async getByUrl(url) {
        const snapshot = await collections.stories
            .where('url', '==', url)
            .limit(1)
            .get();
        const results = snapshotToArray(snapshot);
        return results[0] || null;
    },

    async getTopForNewsletter({ hours = 24, limit = 12 } = {}) {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        const snapshot = await collections.stories
            .where('ingested_at', '>', cutoff)
            .orderBy('ingested_at', 'desc')
            .get();

        // Sort by pe_impact_score in memory (Firestore limitation on multiple orderBy with inequality)
        let results = snapshotToArray(snapshot);

        // Filter out duplicates
        results = results.filter(s => !s.is_duplicate);

        results.sort((a, b) => (b.pe_impact_score || 0) - (a.pe_impact_score || 0));
        return results.slice(0, limit);
    },

    async getTopStories({ limit = 12 } = {}) {
        // Fetch extra to account for duplicates
        const fetchLimit = limit * 2;

        const snapshot = await collections.stories
            .orderBy('pe_impact_score', 'desc')
            .orderBy('ingested_at', 'desc')
            .limit(fetchLimit)
            .get();

        const results = snapshotToArray(snapshot);
        // Filter out duplicates
        const activeResults = results.filter(s => !s.is_duplicate);

        return activeResults.slice(0, limit);
    },

    async create(data) {
        const id = generateId();
        const now = new Date();
        const storyData = {
            ...data,
            ingested_at: data.ingested_at || now,
            created_at: now
        };
        await collections.stories.doc(id).set(storyData);
        return { id, ...storyData };
    },

    async update(id, data) {
        await collections.stories.doc(id).update(data);
        return { id, ...data };
    },

    async incrementVote(id, voteType) {
        const field = voteType === 'up' ? 'thumbs_up_count' : 'thumbs_down_count';
        const story = await this.getById(id);
        const currentValue = story?.[field] || 0;
        await collections.stories.doc(id).update({
            [field]: currentValue + 1
        });
    },

    async incrementClicks(id) {
        const story = await this.getById(id);
        const currentClicks = story?.click_count || 0;
        await collections.stories.doc(id).update({
            click_count: currentClicks + 1
        });
    }
};

// Feedback collection helpers
const feedback = {
    async create(data) {
        const id = generateId();
        const feedbackData = {
            ...data,
            submitted_at: new Date()
        };
        await collections.feedback.doc(id).set(feedbackData);
        return { id, ...feedbackData };
    },

    async getStatsByStoryId(storyId) {
        const snapshot = await collections.feedback
            .where('story_id', '==', storyId)
            .get();

        let thumbs_up = 0;
        let thumbs_down = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.rating === 'up') thumbs_up++;
            if (data.rating === 'down') thumbs_down++;
        });

        return {
            total_feedback: thumbs_up + thumbs_down,
            thumbs_up,
            thumbs_down
        };
    },

    async getAll({ limit = 50, offset = 0 } = {}) {
        const snapshot = await collections.feedback
            .orderBy('submitted_at', 'desc')
            .limit(offset + limit)
            .get();

        const feedbackList = snapshotToArray(snapshot).slice(offset);

        // Fetch associated stories for each feedback to enrich with source/category
        const enriched = await Promise.all(feedbackList.map(async (fb) => {
            if (fb.story_id) {
                const story = await stories.getById(fb.story_id);
                return {
                    ...fb,
                    headline: story?.headline,
                    source: story?.source,
                    source_domain: story?.source_domain || story?.source, // Fallback
                    sectors: story?.pe_analysis?.sectors || []
                };
            }
            return fb;
        }));

        return enriched;
    },

    async getByUser(email) {
        // Assuming 'from_email' is the field for user email in feedback
        // Note: The feedback ingestion uses 'from_email' for email replies.
        // For web feedback, we need to ensure we store the user's email.
        // Currently web feedback might be anonymous or just session based?
        // Let's check script.js... it doesn't send email. 
        // We might need to rely on 'email_reply' feedback for now, OR update web to send email if logged in.
        // For now, we'll query by 'from_email'.

        const snapshot = await collections.feedback
            .where('from_email', '==', email)
            .get();

        const feedbackList = snapshotToArray(snapshot);

        // Enrich with story data
        const enriched = await Promise.all(feedbackList.map(async (fb) => {
            if (fb.story_id) {
                const story = await stories.getById(fb.story_id);
                return {
                    ...fb,
                    headline: story?.headline,
                    source: story?.source,
                    source_domain: story?.source_domain || story?.source,
                    sectors: story?.pe_analysis?.sectors || []
                };
            }
            return fb;
        }));

        return enriched;
    }
};

// Newsletters collection helpers
const newsletters = {
    async getLatest() {
        const snapshot = await collections.newsletters
            .orderBy('date', 'desc')
            .limit(1)
            .get();
        const results = snapshotToArray(snapshot);
        return results[0] || null;
    },

    async getHistory({ limit = 30, offset = 0 } = {}) {
        const snapshot = await collections.newsletters
            .orderBy('date', 'desc')
            .limit(offset + limit)
            .get();
        return snapshotToArray(snapshot).slice(offset);
    },

    async create(data) {
        const id = generateId();
        const newsletterData = {
            ...data,
            created_at: new Date()
        };
        await collections.newsletters.doc(id).set(newsletterData);
        return { id, ...newsletterData };
    }
};

// Subscribers collection helpers
const subscribers = {
    async getActive() {
        const snapshot = await collections.subscribers
            .where('is_active', '==', true)
            .get();
        return snapshotToArray(snapshot);
    },

    async getByEmail(email) {
        const snapshot = await collections.subscribers
            .where('email', '==', email)
            .limit(1)
            .get();
        const results = snapshotToArray(snapshot);
        return results[0] || null;
    },

    async create(data) {
        // Check if already exists
        const existing = await this.getByEmail(data.email);
        if (existing) return null;

        const id = generateId();
        const subscriberData = {
            ...data,
            is_active: true,
            subscribed_at: new Date()
        };
        await collections.subscribers.doc(id).set(subscriberData);
        return { id, ...subscriberData };
    }
};

// Invitations collection helpers
const invitations = {
    async getByCode(code) {
        const snapshot = await collections.invitations
            .where('code', '==', code)
            .where('is_used', '==', false)
            .limit(1)
            .get();
        const results = snapshotToArray(snapshot);
        return results[0] || null;
    },

    async create(code) {
        const id = generateId();
        const inviteData = {
            code,
            is_used: false,
            created_at: new Date()
        };
        await collections.invitations.doc(id).set(inviteData);
        return { id, ...inviteData };
    },

    async markUsed(id, email) {
        await collections.invitations.doc(id).update({
            is_used: true,
            used_by_email: email,
            used_at: new Date()
        });
    }
};

// Source Quality collection helpers
const sourceQuality = {
    async getAll() {
        const snapshot = await collections.sourceQuality.get();
        return snapshotToArray(snapshot);
    },

    async getByDomain(domain) {
        const snapshot = await collections.sourceQuality
            .where('domain', '==', domain)
            .limit(1)
            .get();
        const results = snapshotToArray(snapshot);
        return results[0] || null;
    },

    async upsert(domain, name, scoreChange, isPositive) {
        const existing = await this.getByDomain(domain);

        if (existing) {
            const newScore = Math.max(0, Math.min(10, existing.quality_score + scoreChange));
            await collections.sourceQuality.doc(existing.id).update({
                quality_score: newScore,
                positive_feedback_count: existing.positive_feedback_count + (isPositive ? 1 : 0),
                negative_feedback_count: existing.negative_feedback_count + (isPositive ? 0 : 1),
                last_evaluated_at: new Date()
            });
        } else {
            const id = generateId();
            await collections.sourceQuality.doc(id).set({
                domain,
                name,
                quality_score: 5.0 + scoreChange,
                total_stories: 1,
                positive_feedback_count: isPositive ? 1 : 0,
                negative_feedback_count: isPositive ? 0 : 1,
                last_evaluated_at: new Date()
            });
        }
    }
};

console.log('✓ Firestore database connected');

module.exports = {
    db,
    collections,
    stories,
    feedback,
    newsletters,
    subscribers,
    invitations,
    sourceQuality,
    generateId,
    docToObject,
    snapshotToArray
};
