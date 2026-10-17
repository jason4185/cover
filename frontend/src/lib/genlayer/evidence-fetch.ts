import { createServerFn } from "@tanstack/react-start";
import { MAX_EVIDENCE_BYTES, validateNetlifyUrl } from "./evidence-rules";

const FETCH_TIMEOUT_MS = 8000;

export type EvidenceFetchResult = {
  hash: string;
  byteLength: number;
};

class EvidenceFetchError extends Error {}

function readString(
  source: string,
  start: number,
): { end: number; value: string } | undefined {
  if (source[start] !== '"') return undefined;
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      const token = source.slice(start, index + 1);
      try {
        const value: unknown = JSON.parse(token);
        return typeof value === "string"
          ? { end: index + 1, value }
          : undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function skipWhitespace(source: string, start: number): number {
  let index = start;
  while (/\s/.test(source[index] ?? "")) index += 1;
  return index;
}

/** Detect duplicate object keys so the preview matches COVER's parser rules. */
function hasDuplicateJsonKeys(source: string): boolean {
  let cursor = 0;
  let duplicate = false;
  const scanValue = (): boolean => {
    cursor = skipWhitespace(source, cursor);
    const character = source[cursor];
    if (character === '"') {
      const parsed = readString(source, cursor);
      if (!parsed) return false;
      cursor = parsed.end;
      return true;
    }
    if (character === "{") {
      cursor += 1;
      const keys = new Set<string>();
      cursor = skipWhitespace(source, cursor);
      if (source[cursor] === "}") {
        cursor += 1;
        return true;
      }
      while (cursor < source.length) {
        cursor = skipWhitespace(source, cursor);
        const key = readString(source, cursor);
        if (!key) return false;
        if (keys.has(key.value)) duplicate = true;
        keys.add(key.value);
        cursor = skipWhitespace(source, key.end);
        if (source[cursor] !== ":") return false;
        cursor += 1;
        if (!scanValue()) return false;
        cursor = skipWhitespace(source, cursor);
        if (source[cursor] === "}") {
          cursor += 1;
          return true;
        }
        if (source[cursor] !== ",") return false;
        cursor += 1;
      }
      return false;
    }
    if (character === "[") {
      cursor += 1;
      cursor = skipWhitespace(source, cursor);
      if (source[cursor] === "]") {
        cursor += 1;
        return true;
      }
      while (cursor < source.length) {
        if (!scanValue()) return false;
        cursor = skipWhitespace(source, cursor);
        if (source[cursor] === "]") {
          cursor += 1;
          return true;
        }
        if (source[cursor] !== ",") return false;
        cursor += 1;
      }
      return false;
    }
    const literal =
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
        source.slice(cursor),
      );
    if (!literal) return false;
    cursor += literal[0].length;
    return true;
  };

  if (!scanValue()) return false;
  return duplicate;
}

async function readBoundedBytes(response: Response): Promise<Uint8Array> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_EVIDENCE_BYTES) {
    throw new EvidenceFetchError("The evidence response exceeds 4,096 bytes.");
  }
  if (!response.body)
    throw new EvidenceFetchError("The evidence response is empty.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_EVIDENCE_BYTES) {
        await reader.cancel();
        throw new EvidenceFetchError(
          "The evidence response exceeds 4,096 bytes.",
        );
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (bytes.byteLength === 0)
    throw new EvidenceFetchError("The evidence response is empty.");
  return bytes;
}

export async function fetchAndVerifyEvidence(
  url: string,
): Promise<EvidenceFetchResult> {
  const validationError = validateNetlifyUrl(url);
  if (validationError) throw new EvidenceFetchError(validationError);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new EvidenceFetchError("The evidence URL is invalid.");
  }
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.port ||
    parsedUrl.username ||
    parsedUrl.password ||
    !parsedUrl.hostname.toLowerCase().endsWith(".netlify.app")
  ) {
    throw new EvidenceFetchError(
      "The evidence URL is not an allowed Netlify HTTPS URL.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { accept: "application/json, text/json, */*" },
    });
    if (response.url && response.url !== url) {
      throw new EvidenceFetchError("Evidence redirects are not allowed.");
    }
    if (response.status >= 300 && response.status < 400) {
      throw new EvidenceFetchError("Evidence redirects are not allowed.");
    }
    if (!response.ok) {
      throw new EvidenceFetchError(
        `The evidence host returned HTTP ${response.status}.`,
      );
    }
    const bytes = await readBoundedBytes(response);
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded);
    } catch {
      throw new EvidenceFetchError(
        "The evidence response is not valid UTF-8 JSON.",
      );
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      hasDuplicateJsonKeys(decoded)
    ) {
      throw new EvidenceFetchError(
        "Evidence must be a JSON object without duplicate keys.",
      );
    }
    const compactJson = JSON.stringify(parsed);
    if (
      !compactJson ||
      new TextEncoder().encode(compactJson).byteLength > MAX_EVIDENCE_BYTES
    ) {
      throw new EvidenceFetchError(
        "The compact evidence JSON exceeds 4,096 bytes.",
      );
    }
    const digest = await crypto.subtle.digest(
      "SHA-256",
      bytes as unknown as BufferSource,
    );
    return {
      hash: Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join(""),
      byteLength: bytes.byteLength,
    };
  } catch (cause) {
    if (cause instanceof EvidenceFetchError) throw cause;
    if (controller.signal.aborted) {
      throw new EvidenceFetchError(
        "The evidence host did not respond within 8 seconds.",
      );
    }
    throw new EvidenceFetchError("The evidence file could not be fetched.");
  } finally {
    clearTimeout(timeout);
  }
}

export const fetchEvidenceForVerification = createServerFn({ method: "POST" })
  .validator((input: { url: string }) => input)
  .handler(async ({ data }) => fetchAndVerifyEvidence(data.url));
