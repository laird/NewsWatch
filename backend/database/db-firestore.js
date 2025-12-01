const { Firestore, FieldValue, Timestamp } = require('@google-cloud/firestore');

// Initialize Firestore
const db = new Firestore({
    projectId: process.env.GCP_PROJECT_ID || 'newswatch-local',
    // Uses GOOGLE_APPLICATION_CREDENTIALS env var if set
    // Or Application Default Credentials in GCP environments
});

// Connect to Firestore Emulator if FIRESTORE_EMULATOR_HOST is set
if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`🔧 Using Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
}

// Export Firestore utilities
const FirestoreFieldValue = FieldValue;
const FirestoreTimestamp = Timestamp;

/**
 * Get a single document by ID
 */
async function getDoc(collectionName, docId) {
    const docRef = db.collection(collectionName).doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
        return null;
    }

    return {
        id: doc.id,
        ...doc.data()
    };
}

/**
 * Query documents with filters
 * @param {string} collectionName - Collection to query
 * @param {Array} filters - Array of filter objects: [{field, op, value}, ...]
 * @param {Object} options - Query options {orderBy, limit, offset, select}
 */
async function queryDocs(collectionName, filters = [], options = {}) {
    let query = db.collection(collectionName);

    // Apply filters
    for (const filter of filters) {
        query = query.where(filter.field, filter.op, filter.value);
    }

    // Apply ordering
    if (options.orderBy) {
        if (Array.isArray(options.orderBy)) {
            for (const order of options.orderBy) {
                query = query.orderBy(order.field, order.direction || 'asc');
            }
        } else {
            query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
        }
    }

    // Apply limit and offset
    if (options.offset) {
        query = query.offset(options.offset);
    }
    if (options.limit) {
        query = query.limit(options.limit);
    }

    // Apply field selection
    if (options.select && options.select.length > 0) {
        query = query.select(...options.select);
    }

    const snapshot = await query.get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

/**
 * Add a document with auto-generated ID
 */
async function addDoc(collectionName, data) {
    const docRef = await db.collection(collectionName).add(data);
    const doc = await docRef.get();

    return {
        id: doc.id,
        ...doc.data()
    };
}

/**
 * Set a document with a specific ID (creates or overwrites)
 */
async function setDoc(collectionName, docId, data, options = {}) {
    console.log(`[FIRESTORE] setDoc called for ${collectionName}/${docId}`);
    try {
        const docRef = db.collection(collectionName).doc(docId);
        await docRef.set(data, options);

        const doc = await docRef.get();
        console.log(`[FIRESTORE] setDoc success for ${collectionName}/${docId}`);
        return {
            id: doc.id,
            ...doc.data()
        };
    } catch (error) {
        console.error(`[FIRESTORE] setDoc failed for ${collectionName}/${docId}:`, error);
        throw error;
    }
}

/**
 * Update a document
 */
async function updateDoc(collectionName, docId, data) {
    const docRef = db.collection(collectionName).doc(docId);
    await docRef.update(data);

    const doc = await docRef.get();
    return {
        id: doc.id,
        ...doc.data()
    };
}

/**
 * Delete a document
 */
async function deleteDoc(collectionName, docId) {
    await db.collection(collectionName).doc(docId).delete();
}

/**
 * Run a transaction
 */
async function runTransaction(updateFunction) {
    return await db.runTransaction(updateFunction);
}

/**
 * Get current server timestamp
 */
function serverTimestamp() {
    return FieldValue.serverTimestamp();
}

/**
 * Create a timestamp from a Date object
 */
function timestampFromDate(date) {
    return Timestamp.fromDate(date);
}

/**
 * Increment a numeric field
 */
function increment(value) {
    return FieldValue.increment(value);
}

module.exports = {
    db,
    getDoc,
    queryDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    runTransaction,
    serverTimestamp,
    timestampFromDate,
    increment,
    FieldValue: FirestoreFieldValue,
    Timestamp: FirestoreTimestamp
};
