const SHA256 = /^[0-9a-f]{64}$/;
export const MAX_EVIDENCE_URL_LENGTH = 2048;
export const MAX_EVIDENCE_BYTES = 4096;

/** Mirrors COVER V1's _require_netlify_url checks. */
export function validateNetlifyUrl(value: string): string | undefined {
  if (
    !value ||
    value.length > MAX_EVIDENCE_URL_LENGTH ||
    !value.startsWith("https://")
  ) {
    return "Use an HTTPS URL hosted on a Netlify subdomain.";
  }
  const authority = value.slice(8).split(/[/?]/, 1)[0] ?? "";
  const host = authority.toLowerCase().replace(/\.$/, "");
  if (
    !authority ||
    authority.includes("@") ||
    authority.includes(":") ||
    value.includes("#") ||
    value.includes("\\") ||
    /\s/.test(value)
  ) {
    return "The evidence URL has an invalid host or URL structure.";
  }
  if (!host.endsWith(".netlify.app"))
    return "Use a Netlify subdomain ending in .netlify.app.";
  const site = host.slice(0, -".netlify.app".length);
  const labels = site.split(".");
  if (
    !site ||
    site.startsWith(".") ||
    site.endsWith(".") ||
    site.includes("..") ||
    labels.some(
      (label) => !label || label.startsWith("-") || label.endsWith("-"),
    ) ||
    !/^[a-z0-9.-]+$/.test(site)
  ) {
    return "The Netlify site hostname is invalid.";
  }
  return undefined;
}

export function validateSha256(value: string): string | undefined {
  return SHA256.test(value)
    ? undefined
    : "Enter a lowercase 64-character SHA-256 commitment.";
}
