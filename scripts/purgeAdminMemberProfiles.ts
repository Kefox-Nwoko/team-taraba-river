/**
 * Remove every member-roster profile belonging to an admin account.
 *
 * Admin accounts (config.adminEmails) are not community members and must
 * never have a document in `members` (or its recycle bin / login codes).
 * Their Firebase Auth accounts are left untouched — admins still need them
 * to sign in with Google.
 *
 * Usage:
 *   npx tsx scripts/purgeAdminMemberProfiles.ts            # dry run (lists matches)
 *   npx tsx scripts/purgeAdminMemberProfiles.ts --apply    # actually delete
 */

import { db, adminAuth, isFirestoreAvailable } from '../server/firebaseAdmin';
import { config, isAdminEmail } from '../server/config';

const APPLY = process.argv.includes('--apply');

async function main() {
  if (!isFirestoreAvailable()) {
    throw new Error('Firestore Admin is not available — check service-account.json / ADC.');
  }

  // Resolve the admins' Firebase Auth UIDs so docs keyed by UID are caught
  // even if their email field was blanked or changed.
  const adminUids = new Set<string>();
  for (const email of config.adminEmails) {
    try {
      const user = await adminAuth.getUserByEmail(email);
      adminUids.add(user.uid);
      console.log(`Admin ${email} -> uid ${user.uid}`);
    } catch (err: any) {
      console.log(`Admin ${email} -> no Firebase Auth user (${err?.code || err?.message})`);
    }
  }

  const matches: Array<{ path: string; reason: string }> = [];

  for (const collection of ['members', 'deleted_members']) {
    const snap = await db.collection(collection).get();
    for (const d of snap.docs) {
      const data = d.data() as Record<string, any>;
      const email = typeof data.email === 'string' ? data.email : '';
      const originalId = typeof data.originalId === 'string' ? data.originalId : '';
      let reason = '';
      if (isAdminEmail(email)) reason = `email ${email}`;
      else if (adminUids.has(d.id)) reason = `doc id is admin uid`;
      else if (typeof data.id === 'string' && adminUids.has(data.id)) reason = `id field is admin uid`;
      else if (adminUids.has(originalId)) reason = `originalId is admin uid`;
      if (reason) {
        matches.push({ path: `${collection}/${d.id}`, reason });
        console.log(`  ${collection}/${d.id}  [${reason}]  name="${data.fullName || ''}" role=${data.role || ''}`);
      }
    }
  }

  // Login codes are keyed by member doc ID.
  const memberIds = matches.filter((m) => m.path.startsWith('members/')).map((m) => m.path.split('/')[1]);
  for (const id of new Set([...memberIds, ...adminUids])) {
    const codeDoc = await db.collection('loginCodes').doc(id).get();
    if (codeDoc.exists) {
      matches.push({ path: `loginCodes/${id}`, reason: 'login code for admin profile' });
      console.log(`  loginCodes/${id}`);
    }
  }

  console.log(`\n${matches.length} document(s) matched.`);
  if (!APPLY) {
    console.log('Dry run — nothing deleted. Re-run with --apply to delete.');
    return;
  }

  for (const m of matches) {
    await db.doc(m.path).delete();
    console.log(`Deleted ${m.path}`);
  }
  console.log('Done.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
