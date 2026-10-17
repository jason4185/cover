import { createClient } from "genlayer-js";
import { CalldataAddress } from "genlayer-js/types";
import type { CalldataEncodable } from "genlayer-js/types";
import type { Eip1193Provider } from "@genlayer/transaction-kit";
import type { Address } from "viem";
import { requireCoverAddress, studioNext } from "./config";
import { userFacingError } from "./errors";

export type CoverClient = ReturnType<typeof createClient>;
export type BrowserProvider = Eip1193Provider;

let publicClient: CoverClient | undefined;

export function createCoverClient(
  account?: Address,
  provider?: BrowserProvider,
): CoverClient {
  return createClient({
    chain: studioNext,
    ...(account ? { account } : {}),
    ...(provider ? { provider } : {}),
  });
}

export function getReadClient(): CoverClient {
  requireCoverAddress();
  publicClient ??= createCoverClient();
  return publicClient;
}

export function getConnectedClient(
  provider: BrowserProvider,
  account: Address,
): CoverClient {
  requireCoverAddress();
  return createCoverClient(account, provider);
}

export function getInjectedProvider(): BrowserProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: BrowserProvider }).ethereum;
}

export function toCalldataAddress(value: string): CalldataAddress {
  const normalized = value.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized))
    throw new Error(`Invalid EVM address: ${value}`);
  const bytes = new Uint8Array(20);
  for (let index = 0; index < 20; index += 1) {
    bytes[index] = Number.parseInt(
      normalized.slice(2 + index * 2, 4 + index * 2),
      16,
    );
  }
  return new CalldataAddress(bytes);
}

export async function contractRead<T>(
  method: string,
  args: CalldataEncodable[] = [],
): Promise<T> {
  const address = requireCoverAddress();
  try {
    const result = await getReadClient().readContract({
      address,
      functionName: method,
      args,
      // The installed SDK exposes this enum internally but accepts the
      // documented wire value at runtime.
      transactionHashVariant: "latest-nonfinal" as never,
    });
    return result as T;
  } catch (error) {
    throw new Error(userFacingError(error, "read"));
  }
}
