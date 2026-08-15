/**
 * Set Firebase Custom Claims for Admin Users
 * 
 * Usage:
 *   npx tsx scripts/setAdminClaims.ts
 * 
 * This script sets the 'admin' custom claim on designated admin user accounts.
 * Run this once after the admin users have signed in at least once via Google OAuth
 * (so their Firebase Auth accounts exist).
 * 
 * After running this script, the admin users need to sign out and sign back in
 * for the new claims to take effect in their ID tokens.
 * 
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var set to a service account key file, OR
 *   - Running on a GCP environment with Application Default Credentials
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminAuth = getAuth();
import { config } from '../server/config';

async function setAdminClaims() {
  console.log('Setting admin custom claims...\n');

  for (const email of config.adminEmails) {
    try {
      const user = await adminAuth.getUserByEmail(email);
      await adminAuth.setCustomUserClaims(user.uid, { role: 'admin' });
      console.log(`✅ Admin claim set for: ${email} (uid: ${user.uid})`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.warn(`⚠️  User not found: ${email} — They must sign in via Google OAuth first.`);
      } else {
        console.error(`❌ Error setting claim for ${email}:`, error.message);
      }
    }
  }

  console.log('\nDone. Admin users must sign out and sign back in for claims to take effect.');
}

setAdminClaims().catch(console.error);
