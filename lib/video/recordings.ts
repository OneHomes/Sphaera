import { BlobSASPermissions, BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

// Call recordings live in their own storage account in Central India (next
// to the video server), separate from documents. The video server uploads
// them; Sphaera only reads: short-lived signed links for playback, and a
// restore request when a file has moved to the Archive tier.

const PLAYBACK_LINK_TTL_MINUTES = 60;

function container() {
  const account = process.env.RECORDINGS_STORAGE_ACCOUNT;
  const key = process.env.RECORDINGS_STORAGE_KEY;
  if (!account || !key) return null;
  const service = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    new StorageSharedKeyCredential(account, key)
  );
  return service.getContainerClient(process.env.RECORDINGS_CONTAINER || "recordings");
}

export type RecordingAccess =
  | { state: "playable"; url: string }
  | { state: "archived" } // in Archive: must be restored first (takes hours)
  | { state: "restoring" }
  | { state: "missing" }
  | { state: "not_configured" };

export async function recordingAccess(blobPath: string): Promise<RecordingAccess> {
  const c = container();
  if (!c) return { state: "not_configured" };
  const blob = c.getBlockBlobClient(blobPath);
  try {
    const props = await blob.getProperties();
    if (props.archiveStatus?.startsWith("rehydrate-pending")) return { state: "restoring" };
    if (props.accessTier === "Archive") return { state: "archived" };
    const url = await blob.generateSasUrl({
      permissions: BlobSASPermissions.parse("r"),
      expiresOn: new Date(Date.now() + PLAYBACK_LINK_TTL_MINUTES * 60_000),
    });
    return { state: "playable", url };
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 404) return { state: "missing" };
    throw err;
  }
}

// Brings an archived recording back to the Cold tier (still cheap, plays
// instantly). Azure takes up to ~15 hours at standard priority. The
// lifecycle rule moves it back to Archive later on its own.
export async function restoreRecording(blobPath: string): Promise<void> {
  const c = container();
  if (!c) throw new Error("Recording storage isn't set up (RECORDINGS_STORAGE_ACCOUNT / RECORDINGS_STORAGE_KEY)");
  await c.getBlockBlobClient(blobPath).setAccessTier("Cold", { rehydratePriority: "Standard" });
}
