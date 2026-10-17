import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAndVerifyEvidence } from "./evidence-fetch";

const evidenceUrl = "https://cover-case.netlify.app/evidence.json";

function response(body: string, init?: ResponseInit) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("server-side evidence verification", () => {
  afterEach(() => vi.restoreAllMocks());

  it("hashes the exact raw response bytes", async () => {
    const raw = '{"incident":"unauthorized action"}\n';
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(raw));

    await expect(fetchAndVerifyEvidence(evidenceUrl)).resolves.toEqual({
      hash: "aee633fa9b8967259dd4d3d97632b0cfafb55674497da06087a35540b7dbef8e",
      byteLength: new TextEncoder().encode(raw).byteLength,
    });
  });

  it("rejects malformed JSON and duplicate object keys", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(response("not-json"));
    await expect(fetchAndVerifyEvidence(evidenceUrl)).rejects.toThrow(
      "not valid UTF-8 JSON",
    );

    fetchMock.mockResolvedValueOnce(response('{"a":1,"a":2}'));
    await expect(fetchAndVerifyEvidence(evidenceUrl)).rejects.toThrow(
      "without duplicate keys",
    );
  });

  it("rejects oversized, redirected, and non-2xx responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(
      response('{"ok":true}', {
        headers: { "content-length": "4097" },
      }),
    );
    await expect(fetchAndVerifyEvidence(evidenceUrl)).rejects.toThrow(
      "exceeds 4,096 bytes",
    );

    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example" },
      }),
    );
    await expect(fetchAndVerifyEvidence(evidenceUrl)).rejects.toThrow(
      "redirects are not allowed",
    );

    fetchMock.mockResolvedValueOnce(response("no", { status: 503 }));
    await expect(fetchAndVerifyEvidence(evidenceUrl)).rejects.toThrow(
      "HTTP 503",
    );
  });

  it("rejects invalid URLs before making a network request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(
      fetchAndVerifyEvidence("https://localhost/evidence.json"),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports network failures without producing a commitment", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("blocked by CORS"),
    );

    await expect(fetchAndVerifyEvidence(evidenceUrl)).rejects.toThrow(
      "could not be fetched",
    );
  });

  it("produces a different commitment when the raw bytes change", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(response('{"version":1}'));
    const first = await fetchAndVerifyEvidence(evidenceUrl);
    fetchMock.mockResolvedValueOnce(response('{"version":2}'));
    const second = await fetchAndVerifyEvidence(evidenceUrl);
    expect(first.hash).not.toBe(second.hash);
  });
});
