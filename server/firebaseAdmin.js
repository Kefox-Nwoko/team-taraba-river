import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { cert } from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { serverLogger } from './logger';
const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
// Initialize Firebase Admin SDK
let app;
let firestoreAvailable = false;
const credentialsPath = config.googleApplicationCredentials;
const hasCredentials = !!credentialsPath || process.env.NODE_ENV === 'production';
if (hasCredentials) {
    const resolvedPath = credentialsPath ? path.resolve(process.cwd(), credentialsPath) : null;
    const fileExists = resolvedPath ? fs.existsSync(resolvedPath) : false;
    if (fileExists) {
        if (getApps().length === 0) {
            const initConfig = {
                projectId: firebaseConfig.projectId,
                storageBucket: firebaseConfig.storageBucket,
            };
            initConfig.credential = cert(resolvedPath);
            app = initializeApp(initConfig);
        }
        else {
            app = getApps()[0];
        }
        firestoreAvailable = true;
    }
    else {
        serverLogger.warn(`Firebase Admin SDK: credentials file not found at ${resolvedPath || 'GOOGLE_APPLICATION_CREDENTIALS'}. Firestore Admin access is disabled for this session. The app will use in-memory fallback data.`);
        firestoreAvailable = false;
    }
}
else {
    serverLogger.warn('Firebase Admin SDK: No GOOGLE_APPLICATION_CREDENTIALS found and not in production. Firestore Admin access is disabled for this session. The app will use in-memory fallback data.');
    firestoreAvailable = false;
}
// Use the custom Firestore database if specified
const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || '(default)';
// Create a dummy db proxy that just ignores calls if not available
const dummyDb = new Proxy({}, {
    get: (target, prop) => {
        if (prop === 'then') {
            return (resolve) => resolve({ empty: true, docs: [] });
        }
        return () => dummyDb; // allow chaining db.collection().doc().get() etc
    }
});
let db = dummyDb;
let adminAuth = dummyDb;
if (app && firestoreAvailable) {
    if (firestoreDatabaseId !== '(default)') {
        db = getFirestore(app, firestoreDatabaseId);
    }
    else {
        db = getFirestore(app);
    }
    adminAuth = getAuth(app);
}
/**
 * Check Firestore connectivity on first call.
 */
export async function checkFirestoreConnection() {
    if (!hasCredentials) {
        firestoreAvailable = false;
        return false;
    }
    try {
        await db.collection('members').limit(1).get();
        firestoreAvailable = true;
        return true;
    }
    catch (err) {
        if (err.message?.includes('default credentials') || err.code === 'UNAUTHENTICATED') {
            serverLogger.warn('Firebase Admin SDK: No Application Default Credentials found. Firestore Admin access is disabled for this session. The app will use the frontend Firebase client SDK for data access. To enable full backend auth, set GOOGLE_APPLICATION_CREDENTIALS.');
            firestoreAvailable = false;
            return false;
        }
        throw err;
    }
}
export function isFirestoreAvailable() {
    return firestoreAvailable;
}
export { db, adminAuth };
