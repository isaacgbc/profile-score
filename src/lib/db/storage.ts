import { createClient } from "@supabase/supabase-js";

const BUCKET = "exports";

function getStorageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key).storage.from(BUCKET);
}

/**
 * Upload export artifact bytes to Supabase Storage.
 * @returns The storage path (e.g. "exports/{auditId}/{exportId}.pdf")
 */
export async function uploadExport(
  auditId: string,
  exportId: string,
  ext: string,
  bytes: Uint8Array,
  contentType: string
): Promise<string> {
  const path = `${auditId}/${exportId}.${ext}`;
  const storage = getStorageClient();
  const { error } = await storage.upload(path, bytes, { contentType });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

/**
 * Generate a signed download URL for an export artifact.
 * @param storagePath The path returned by `uploadExport`
 * @param expiresIn Seconds until the URL expires (default: 5 minutes)
 */
export async function getSignedUrl(
  storagePath: string,
  expiresIn = 300
): Promise<string> {
  const storage = getStorageClient();
  const { data, error } = await storage.createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL generation failed: ${error?.message}`);
  }
  return data.signedUrl;
}

/**
 * Delete an export artifact from Supabase Storage.
 */
export async function deleteExport(storagePath: string): Promise<void> {
  const storage = getStorageClient();
  const { error } = await storage.remove([storagePath]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
