import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { cert } from 'firebase-admin';

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
  serverLogger.warn(`Firebase Admin SDK: credentials file not found. Searched: ${candidatePaths.join(', ')}. Firestore Admin access is disabled for this session.`);
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
    try {
      db = getFirestore(app, firestoreDatabaseId);
      adminAuth = getAuth(app);
    } catch (err) {
      serverLogger.warn('Failed to init custom database, falling back to (default)', { error: String(err) });
      db = getFirestore(app);
      adminAuth = getAuth(app);
    }
  } else {
    db = getFirestore(app);
    adminAuth = getAuth(app);
  }
}

/**
 * Check Firestore connectivity on first call. Falls back to (default) DB.
 */
export async function checkFirestoreConnection(): Promise<boolean> {
  if (!firestoreAvailable || !app) {
    firestoreAvailable = false;
    return false;
  }
  try {
    await db.collection('members').limit(1).get();
    firestoreAvailable = true;
    serverLogger.info(`Firestore connected using database: ${firestoreDatabaseId}`);
    return true;
  } catch (err: any) {
    serverLogger.error('Firestore connection test failed', {
      message: err?.message,
      code: err?.code,
    });
    // Fallback to (default) database if a custom one was configured and failed
    if (firestoreDatabaseId !== '(default)') {
      try {
        serverLogger.info('Trying (default) database as fallback...');
        db = getFirestore(app);
        await db.collection('members').limit(1).get();
        firestoreAvailable = true;
        serverLogger.info('Firestore connected using (default) database');
        return true;
      } catch (fallbackErr: any) {
        serverLogger.error('Fallback to (default) database also failed', {
          message: fallbackErr?.message,
          code: fallbackErr?.code,
        });
      }
    }
    firestoreAvailable = false;
    return false;
  }
}

export function isFirestoreAvailable(): boolean {
  return firestoreAvailable;
}

export { db, adminAuth };
