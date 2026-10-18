import { studioDevnet } from "genlayer-js/chains";
import type { GenLayerChain } from "@genlayer/transaction-kit";
import type { Address } from "viem";

export const STUDIO_NEXT_CHAIN_ID = 61997;
export const STUDIO_NEXT_CHAIN_ID_HEX = `0x${STUDIO_NEXT_CHAIN_ID.toString(16)}`;
export const STUDIO_NEXT_RUNNER =
  "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng";
const configuredChainId = import.meta.env["VITE_GENLAYER_CHAIN_ID"] as
  string | undefined;
const parsedChainId = configuredChainId
  ? Number(configuredChainId)
  : STUDIO_NEXT_CHAIN_ID;
const configuredRpcUrl = import.meta.env["VITE_GENLAYER_RPC_URL"] as
  string | undefined;
const STUDIO_NEXT_DEFAULT_RPC_URL = "https://studio-next.genlayer.com/api";
export const STUDIO_NEXT_RPC_URL =
  configuredRpcUrl || STUDIO_NEXT_DEFAULT_RPC_URL;
export const STUDIO_NEXT_EXPLORER_URL =
  "https://explorer-studio-dev.genlayer.com";
export const OFFICIAL_COVER_CONTRACT_ADDRESS =
  "0x0982ebee0aA80Ed50c51903186ae5765e06879d8" as Address;

const configuredAddress = import.meta.env["VITE_COVER_CONTRACT_ADDRESS"] as
  string | undefined;
const validConfiguredAddress =
  configuredAddress && /^0x[0-9a-fA-F]{40}$/.test(configuredAddress);
const officialConfiguredAddress =
  validConfiguredAddress &&
  configuredAddress?.toLowerCase() ===
    OFFICIAL_COVER_CONTRACT_ADDRESS.toLowerCase();

export const COVER_CONTRACT_ADDRESS = officialConfiguredAddress
  ? (configuredAddress as Address)
  : undefined;
export const COVER_CONFIGURED =
  Boolean(COVER_CONTRACT_ADDRESS) && parsedChainId === STUDIO_NEXT_CHAIN_ID;
export const GENLAYER_CONFIG_ERROR = !COVER_CONTRACT_ADDRESS
  ? !configuredAddress
    ? "COVER is not configured yet. Set VITE_COVER_CONTRACT_ADDRESS before using on-chain data."
    : "COVER is configured for an unsupported deployment. Use the official V3 contract address."
  : parsedChainId !== STUDIO_NEXT_CHAIN_ID
    ? `COVER requires Studio Next chain ${STUDIO_NEXT_CHAIN_ID}; received ${parsedChainId}.`
    : undefined;

export const COVER_QUERY_SCOPE = [
  "cover",
  "deployment",
  STUDIO_NEXT_CHAIN_ID,
  STUDIO_NEXT_RPC_URL,
  OFFICIAL_COVER_CONTRACT_ADDRESS.toLowerCase(),
] as const;

export const studioNext = {
  ...studioDevnet,
  id: STUDIO_NEXT_CHAIN_ID,
  name: "GenLayer Studio Next",
  rpcUrls: { default: { http: [STUDIO_NEXT_RPC_URL] } },
  blockExplorers: {
    default: {
      name: "GenLayer Studio Explorer",
      url: STUDIO_NEXT_EXPLORER_URL,
    },
  },
} satisfies GenLayerChain;

export const STUDIO_NEXT_NETWORK_PARAMS = {
  chainId: STUDIO_NEXT_CHAIN_ID_HEX,
  chainName: "GenLayer Studio Next",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: [STUDIO_NEXT_RPC_URL],
  blockExplorerUrls: [STUDIO_NEXT_EXPLORER_URL],
};

export function explorerTransactionUrl(txId: string) {
  return `${STUDIO_NEXT_EXPLORER_URL}/tx/${txId}`;
}

export function explorerAddressUrl(address: string) {
  return `${STUDIO_NEXT_EXPLORER_URL}/address/${address}`;
}

export function requireCoverAddress(): Address {
  if (!COVER_CONFIGURED || !COVER_CONTRACT_ADDRESS)
    throw new Error(GENLAYER_CONFIG_ERROR ?? "COVER is unconfigured.");
  return COVER_CONTRACT_ADDRESS;
}
