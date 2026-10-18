import { isHexAddress, parseGenAmount } from "./format";

export const MAX_AGENT_ID = 160;
export const MAX_CONDITIONS = 4_000;
export const MAX_EXCLUSIONS = 4_000;
export const MAX_DESCRIPTION = 4_000;
export const MAX_RESPONSE = 4_000;

function hasUnsupportedControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if ((code < 0x20 && ![0x09, 0x0a, 0x0d].includes(code)) || code === 0x7f)
      return true;
  }
  return false;
}

export function validateText(
  value: string,
  field: string,
  limit: number,
  required = true,
): string | undefined {
  const normalized = value.trim();
  if ((required && !normalized) || Array.from(normalized).length > limit)
    return `${field} is required and must be no longer than ${limit.toLocaleString()} characters.`;
  if (hasUnsupportedControlCharacters(value))
    return `${field} contains an unsupported control character.`;
  return undefined;
}

export function validateAgentId(value: string): string | undefined {
  return validateText(value, "The insured agent identifier", MAX_AGENT_ID);
}

export function validatePolicyTerms(
  conditions: string,
  exclusions: string,
): string | undefined {
  return (
    validateText(conditions, "Coverage conditions", MAX_CONDITIONS) ??
    validateText(exclusions, "Exclusions", MAX_EXCLUSIONS)
  );
}

export function validatePolicyholderAddress(value: string): string | undefined {
  if (!isHexAddress(value))
    return "Enter a valid 20-byte policyholder address.";
  if (/^0x0{40}$/i.test(value))
    return "The policyholder address cannot be the zero address.";
  return undefined;
}

export function validateCompensation(
  value: string,
): { value: bigint } | { error: string } {
  try {
    const amount = parseGenAmount(value);
    if (amount <= 0n)
      return { error: "Compensation must be greater than zero." };
    return { value: amount };
  } catch (cause) {
    return {
      error:
        cause instanceof Error ? cause.message : "Enter a valid GEN amount.",
    };
  }
}

export function validateDurationDays(
  value: string,
): { value: bigint; days: number } | { error: string } {
  if (!/^\d+$/.test(value.trim()))
    return {
      error: "Coverage duration must be a whole number from 1 to 366 days.",
    };
  const days = Number(value);
  if (!Number.isSafeInteger(days) || days < 1 || days > 366)
    return {
      error: "Coverage duration must be a whole number from 1 to 366 days.",
    };
  return { value: BigInt(days) * 86_400n, days };
}

export function validateIncidentTime(
  value: string,
  activationTime: number,
  expirationTime: number,
  now = Math.floor(Date.now() / 1000),
): { value: bigint } | { error: string } {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds))
    return { error: "Choose the claimed incident time." };
  const seconds = Math.floor(milliseconds / 1000);
  if (
    !Number.isSafeInteger(seconds) ||
    seconds < activationTime ||
    seconds > expirationTime ||
    seconds > now
  ) {
    return {
      error:
        "The incident time must fall within the policy period and not be in the future.",
    };
  }
  return { value: BigInt(seconds) };
}
