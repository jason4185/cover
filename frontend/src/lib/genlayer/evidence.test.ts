import { describe, expect, it } from "vitest";
import { sha256File, validateNetlifyUrl, validateSha256 } from "./evidence";

describe("evidence input boundaries", () => {
  it("accepts only HTTPS Netlify hosts", () => {
    expect(
      validateNetlifyUrl("https://cover-case.netlify.app/evidence.json"),
    ).toBeUndefined();
    expect(
      validateNetlifyUrl("http://cover-case.netlify.app/evidence.json"),
    ).toBeTruthy();
    expect(
      validateNetlifyUrl("https://evil.example/evidence.json"),
    ).toBeTruthy();
    expect(
      validateNetlifyUrl("https://netlify.app/evidence.json"),
    ).toBeTruthy();
    expect(
      validateNetlifyUrl(
        "https://cover-case.netlify.app/evidence.json?version=2",
      ),
    ).toBeUndefined();
    expect(
      validateNetlifyUrl("https://cover-case.netlify.app:443/evidence.json"),
    ).toBeTruthy();
    expect(
      validateNetlifyUrl("https://user@cover-case.netlify.app/evidence.json"),
    ).toBeTruthy();
    expect(
      validateNetlifyUrl("https://cover..netlify.app/evidence.json"),
    ).toBeTruthy();
  });

  it("requires a lowercase raw SHA-256 commitment", () => {
    expect(validateSha256("a".repeat(64))).toBeUndefined();
    expect(validateSha256("A".repeat(64))).toBeTruthy();
    expect(validateSha256("not-a-hash")).toBeTruthy();
  });

  it("hashes the exact bytes of a local file for optional troubleshooting", async () => {
    const raw = '{"a":1}\n';
    await expect(sha256File(new File([raw], "evidence.json"))).resolves.toBe(
      "e346432021b04179518d9614f3560ccd71354a4ee101ddcb893d6959a9d6301c",
    );
  });
});
