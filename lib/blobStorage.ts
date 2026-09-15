import { BlobServiceClient, BlobSASPermissions } from "@azure/storage-blob";

// PRD PF08 (Document and File Service). The Document Prisma model already
// had blobName/contentType/sizeBytes fields scaffolded — this is the
// actual wiring to Azure Blob Storage that was missing. Container access
// level is Private (no anonymous access), so downloads always go through
// a short-lived SAS URL rather than a public blob URL.

const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || "documents";
const DOWNLOAD_URL_TTL_MINUTES = 15;

function getContainerClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");
  }
  const serviceClient = BlobServiceClient.fromConnectionString(connectionString);
  return serviceClient.getContainerClient(CONTAINER_NAME);
}

export async function uploadDocumentBlob(
  blobName: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  const container = getContainerClient();
  // Self-heal: create the container on first use rather than requiring a
  // manual Portal step first. No `access` option is passed, so it's
  // created private (no anonymous access) — matching the setup guidance.
  await container.createIfNotExists();
  const blockBlobClient = container.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(data, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

/** Short-lived, read-only SAS URL — the container itself has no public access. */
export async function getDocumentDownloadUrl(blobName: string): Promise<string> {
  const container = getContainerClient();
  const blockBlobClient = container.getBlockBlobClient(blobName);
  return blockBlobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse("r"),
    expiresOn: new Date(Date.now() + DOWNLOAD_URL_TTL_MINUTES * 60_000),
  });
}

export async function deleteDocumentBlob(blobName: string): Promise<void> {
  const container = getContainerClient();
  await container.getBlockBlobClient(blobName).deleteIfExists();
}
