import { fetchEvidenceForVerification } from "./evidence-fetch";
export {
  MAX_EVIDENCE_BYTES,
  MAX_EVIDENCE_URL_LENGTH,
  validateNetlifyUrl,
  validateSha256,
} from "./evidence-rules";

export async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export type EvidenceVerification = {
  hash: string;
  byteLength: number;
};

export async function verifyEvidenceUrl(
  url: string,
  signal?: AbortSignal,
): Promise<EvidenceVerification> {
  return fetchEvidenceForVerification({
    data: { url },
    ...(signal ? { signal } : {}),
  });
}
