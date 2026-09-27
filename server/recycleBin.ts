/**
 * Universal recycle bin: every "delete" in the app funnels through
 * moveToRecycleBin() instead of ever calling .delete() on the original
 * Firestore doc or the underlying Storage/YouTube file directly. Nothing is
 * actually destroyed until purgeFromRecycleBin() runs (developer-admin only,
 * gated at the route layer in server.ts) — restoreFromRecycleBin() undoes a
 * delete in full.
 */
import { db, FieldValue, deleteStorageFileByUrl } from './firebaseAdmin';
import { deleteYouTubeVideoById, extractYouTubeId } from './mediaPipeline';
import { serverLogger } from './logger';

export type RecycleObjectType = 'member' | 'event' | 'mediaAsset' | 'approvalRequest';

export interface RecycleActor {
  uid: string;
  email: string;
  name: string;
}

export interface RecycleBinEntry {
  id: string;
  objectType: RecycleObjectType;
  originalCollection: string;
  originalId: string;
  // Full original document data, enough to recreate it verbatim on restore.
  // For a `mediaAsset` entry this is `{ assetUrl: string, type: 'photo' | 'video' }`.
  snapshot: Record<string, any>;
  // Storage/YouTube URLs that must be permanently destroyed on purge — left
  // untouched until then. Absent for object types with nothing to purge
  // beyond the Firestore doc itself (member, approvalRequest).
  assetUrls?: string[];
  // Only set for `mediaAsset` entries — which event's array to restore into.
  parentEventId?: string;
  // Human-readable label for the recycle-bin UI, e.g. "Adaeze Umeh" or
  // "Event: The Confluence Jersey Party".
  originalLocation: string;
  deletedAt: string;
  deletedBy: RecycleActor;
}

const RECYCLE_BIN_COLLECTION = 'recycleBin';
const AUDIT_LOG_COLLECTION = 'auditLogs';

async function writeAuditLog(
  action: 'delete' | 'restore' | 'purge',
  entry: Pick<RecycleBinEntry, 'objectType' | 'originalId' | 'originalLocation'>,
  actor: RecycleActor,
  summary: string
): Promise<void> {
  try {
    const ref = db.collection(AUDIT_LOG_COLLECTION).doc();
    await ref.set({
      id: ref.id,
      action,
      objectType: entry.objectType,
      objectId: entry.originalId,
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorName: actor.name,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // The audit log is best-effort — it must never block or roll back the
    // actual delete/restore/purge it's describing.
    serverLogger.error('Failed to write audit log entry', err);
  }
}

/**
 * Snapshots an object into the recycle bin. Callers must write this BEFORE
 * detaching/removing the original — the copy has to exist first, otherwise
 * a write failure here would leave the delete step (done by the caller,
 * right after this resolves) destroying the only record of the item.
 */
export async function moveToRecycleBin(
  entry: Omit<RecycleBinEntry, 'id' | 'deletedAt'>
): Promise<RecycleBinEntry> {
  const ref = db.collection(RECYCLE_BIN_COLLECTION).doc();
  const fullEntry: RecycleBinEntry = {
    ...entry,
    id: ref.id,
    deletedAt: new Date().toISOString(),
  };
  await ref.set(fullEntry);
  await writeAuditLog(
    'delete',
    fullEntry,
    fullEntry.deletedBy,
    `Moved ${entry.objectType} "${entry.originalLocation}" to the recycle bin`
  );
  return fullEntry;
}

export async function getRecycleBinEntries(): Promise<RecycleBinEntry[]> {
  const snap = await db.collection(RECYCLE_BIN_COLLECTION).orderBy('deletedAt', 'desc').get();
  return snap.docs.map((d) => d.data() as RecycleBinEntry);
}

async function restoreEntry(entry: RecycleBinEntry): Promise<void> {
  switch (entry.objectType) {
    case 'member':
      await db.collection('members').doc(entry.originalId).set(entry.snapshot);
      break;
    case 'event':
      await db.collection('events').doc(entry.originalId).set(entry.snapshot);
      break;
    case 'approvalRequest':
      await db.collection('photoRequests').doc(entry.originalId).set(entry.snapshot);
      break;
    case 'mediaAsset': {
      if (!entry.parentEventId) throw new Error('Recycle bin entry is missing its parent event.');
      const eventRef = db.collection('events').doc(entry.parentEventId);
      const eventSnap = await eventRef.get();
      if (!eventSnap.exists) {
        // The folder itself was deleted after this asset was — it's sitting
        // in the recycle bin too. Restore the folder first, then this.
        throw new Error('The folder this item belongs to is also in the recycle bin — restore the folder first.');
      }
      const field = entry.snapshot.type === 'video' ? 'youtubeVideoUrls' : 'driveImageUrls';
      const update: Record<string, any> = { [field]: FieldValue.arrayUnion(entry.snapshot.assetUrl) };
      // youtubeVideoUrls is the array; youtubeVideoUrl is a separate
      // "primary video" field the UI reads directly — restoring the array
      // alone leaves it stale/empty if this was the folder's last video.
      if (entry.snapshot.type === 'video' && !eventSnap.data()?.youtubeVideoUrl) {
        update.youtubeVideoUrl = entry.snapshot.assetUrl;
      }
      await eventRef.update(update);
      break;
    }
  }
}

export async function restoreFromRecycleBin(entryId: string, actor: RecycleActor): Promise<RecycleBinEntry> {
  const ref = db.collection(RECYCLE_BIN_COLLECTION).doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Recycle bin entry not found.');
  const entry = snap.data() as RecycleBinEntry;

  await restoreEntry(entry);
  await ref.delete();
  await writeAuditLog('restore', entry, actor, `Restored ${entry.objectType} "${entry.originalLocation}" from the recycle bin`);
  return entry;
}

async function purgeEntry(entry: RecycleBinEntry): Promise<void> {
  for (const url of entry.assetUrls || []) {
    try {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        await deleteYouTubeVideoById(videoId);
      } else {
        // No-ops for anything that isn't a firebasestorage.googleapis.com
        // URL (e.g. a Google Drive link) — there is no delete capability
        // for Drive-hosted files anywhere in this app.
        await deleteStorageFileByUrl(url);
      }
    } catch (err) {
      serverLogger.error(`Failed to purge asset for recycle bin entry ${entry.id}`, { url, error: String(err) });
    }
  }
}

export async function purgeFromRecycleBin(entryId: string, actor: RecycleActor): Promise<void> {
  const ref = db.collection(RECYCLE_BIN_COLLECTION).doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Recycle bin entry not found.');
  const entry = snap.data() as RecycleBinEntry;

  await purgeEntry(entry);
  await ref.delete();
  await writeAuditLog('purge', entry, actor, `Permanently purged ${entry.objectType} "${entry.originalLocation}"`);
}

export async function restoreAllFromRecycleBin(actor: RecycleActor): Promise<number> {
  const entries = await getRecycleBinEntries();
  let restoredCount = 0;
  for (const entry of entries) {
    try {
      await restoreEntry(entry);
      await db.collection(RECYCLE_BIN_COLLECTION).doc(entry.id).delete();
      await writeAuditLog('restore', entry, actor, `Restored ${entry.objectType} "${entry.originalLocation}" from the recycle bin`);
      restoredCount++;
    } catch (err) {
      // One entry failing (e.g. a photo whose parent folder is also still
      // in the bin and hasn't been restored yet) must not block the rest —
      // it's left in the bin for a retry once its dependency is resolved.
      serverLogger.error(`Failed to restore recycle bin entry ${entry.id} during restore-all`, { error: String(err) });
    }
  }
  return restoredCount;
}

export async function purgeAllFromRecycleBin(actor: RecycleActor): Promise<number> {
  const entries = await getRecycleBinEntries();
  for (const entry of entries) {
    await purgeEntry(entry);
    await db.collection(RECYCLE_BIN_COLLECTION).doc(entry.id).delete();
    await writeAuditLog('purge', entry, actor, `Permanently purged ${entry.objectType} "${entry.originalLocation}"`);
  }
  return entries.length;
}

export async function getAuditLog(limitCount = 200): Promise<any[]> {
  const snap = await db.collection(AUDIT_LOG_COLLECTION).orderBy('timestamp', 'desc').limit(limitCount).get();
  return snap.docs.map((d) => d.data());
}
