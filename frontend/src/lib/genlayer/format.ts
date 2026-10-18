const GEN_BASE = 10n ** 18n;
export const U256_MAX = (1n << 256n) - 1n;

export function asBigInt(value: unknown, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value))
    return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`Contract returned an invalid ${field}.`);
}

export function asNumber(value: unknown, field: string): number {
  const result = asBigInt(value, field);
  const number = Number(result);
  if (!Number.isSafeInteger(number))
    throw new Error(`Contract returned an unsafe ${field}.`);
  return number;
}

export function asString(value: unknown, field: string): string {
  if (typeof value !== "string")
    throw new Error(`Contract returned an invalid ${field}.`);
  return value;
}

export function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean")
    throw new Error(`Contract returned an invalid ${field}.`);
  return value;
}

export function formatGen(value: bigint): string {
  const whole = value / GEN_BASE;
  const fraction = (value % GEN_BASE)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} GEN`;
}

export function formatGenShort(value: bigint): string {
  const whole = value / GEN_BASE;
  const fraction = (value % GEN_BASE)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction.slice(0, 4)}` : ""}`;
}

export function parseGenAmount(value: string): bigint {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(normalized)) {
    throw new Error(
      "Enter a non-negative GEN amount with up to 18 decimal places.",
    );
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  const result =
    BigInt(whole) * GEN_BASE + BigInt(fraction.padEnd(18, "0") || "0");
  if (result > U256_MAX)
    throw new Error("The GEN amount is too large for the contract.");
  return result;
}

export function formatAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function formatHash(value: string): string {
  if (value.length < 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function formatDate(seconds: number): string {
  if (!seconds) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(seconds * 1000));
}

export function formatDateTime(seconds: number): string {
  if (!seconds) return "—";
  return `${formatDate(seconds)} · ${new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(seconds * 1000))} UTC`;
}

export function formatStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function sameAddress(
  left: string | undefined,
  right: string | undefined,
): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

export function isHexAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}
