import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { cert, applicationDefault } from 'firebase-admin';

import fs from 'fs';
import path from 'path';
import { config } from './config';
import { serverLogger } from './logger';

const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

// Initialize Firebase Admin SDK
let app: App | undefined;
let firestoreAvailable = false;

const credentialsPath = config.googleApplicationCredentials;
const candidatePaths = [
  credentialsPath ? path.resolve(process.cwd(), credentialsPath) : null,
  path.resolve(process.cwd(), 'service-account.json'),
  path.resolve(process.cwd(), '..', 'service-account.json'),
].filter(Boolean) as string[];

let resolvedPath: string | null = null;
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    resolvedPath = p;
    break;
  }
}

const hasCredentials = !!resolvedPath;

if (hasCredentials && resolvedPath) {
  if (getApps().length === 0) {
    const initConfig: any = {
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
    };
    initConfig.credential = cert(resolvedPath as string);
    app = initializeApp(initConfig);
  } else {
    app = getApps()[0];
  }
  firestoreAvailable = true;
  serverLogger.info(`Firebase Admin SDK: initialized using credentials at ${resolvedPath}`);
} else {
  serverLogger.warn(`Firebase Admin SDK: credentials file not found. Searched: ${candidatePaths.join(', ')}. Firestore Admin access is disabled for this session. The app will use in-memory fallback data.`);
  firestoreAvailable = false;
}

// Use the custom Firestore database if specified
const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || '(default)';

// Create a dummy db proxy that just ignores calls if not available
const dummyDb: any = new Proxy({}, {
  get: (target, prop) => {
    if (prop === 'then') {
      return (resolve: any) => resolve({ empty: true, docs: [] });
    }
    return () => dummyDb; // allow chaining db.collection().doc().get() etc
  }
});

let db: Firestore = dummyDb as Firestore;
let adminAuth: Auth = dummyDb as unknown as Auth;

if (app && firestoreAvailable) {
  if (firestoreDatabaseId !== '(default)') {
    db = getFirestore(app, firestoreDatabaseId);
  } else {
    db = getFirestore(app);
  }
  adminAuth = getAuth(app);
}

/**
 * Check Firestore connectivity on first call.
 */
export async function checkFirestoreConnection(): Promise<boolean> {
  if (!firestoreAvailable || !app) {
    firestoreAvailable = false;
    return false;
  }
  try {
    await db.collection('members').limit(1).get();
    firestoreAvailable = true;
    return true;
  } catch (err: any) {
    if (err.message?.includes('default credentials') || err.code === 'UNAUTHENTICATED') {
      serverLogger.warn('Firebase Admin SDK: No Application Default Credentials found. Firestore Admin access is disabled for this session. The app will use the frontend Firebase client SDK for data access. To enable full backend auth, set GOOGLE_APPLICATION_CREDENTIALS.');
      firestoreAvailable = false;
      return false;
    }
    throw err;
  }
}

export function isFirestoreAvailable(): boolean {
  return firestoreAvailable;
}

export { db, adminAuth };
