import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createTransactionKit,
  type TransactionKit,
} from "@genlayer/transaction-kit";
import type { Address } from "viem";
import {
  COVER_CONFIGURED,
  STUDIO_NEXT_CHAIN_ID,
  STUDIO_NEXT_CHAIN_ID_HEX,
  STUDIO_NEXT_NETWORK_PARAMS,
  studioNext,
} from "./config";
import {
  getConnectedClient,
  getInjectedProvider,
  type BrowserProvider,
  type CoverClient,
} from "./client";
import { userFacingError } from "./errors";

export type WalletStatus =
  "disconnected" | "connecting" | "connected" | "wrong-network";

type WalletContextValue = {
  address?: Address;
  chainId?: number;
  status: WalletStatus;
  provider?: BrowserProvider;
  kit?: TransactionKit;
  connectedClient?: CoverClient;
  error?: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToStudioNext: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

function parseChainId(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value);
  const parsed = Number.parseInt(text, text.startsWith("0x") ? 16 : 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseAddress(value: unknown): Address | undefined {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)
    ? (value as Address)
    : undefined;
}

async function readWallet(provider: BrowserProvider) {
  const [accounts, chainId] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" }),
  ]);
  const address = Array.isArray(accounts)
    ? parseAddress(accounts[0])
    : undefined;
  return { address, chainId: parseChainId(chainId) };
}

async function switchWallet(provider: BrowserProvider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIO_NEXT_CHAIN_ID_HEX }],
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    if (code !== 4902 && code !== "4902") throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [STUDIO_NEXT_NETWORK_PARAMS],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIO_NEXT_CHAIN_ID_HEX }],
    });
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider>();
  const [address, setAddress] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [error, setError] = useState<string>();

  const refresh = useCallback(async (nextProvider: BrowserProvider) => {
    const result = await readWallet(nextProvider);
    setProvider(nextProvider);
    setAddress(result.address);
    setChainId(result.chainId);
    setStatus(
      result.address
        ? result.chainId === STUDIO_NEXT_CHAIN_ID
          ? "connected"
          : "wrong-network"
        : "disconnected",
    );
  }, []);

  useEffect(() => {
    const injected = getInjectedProvider();
    if (!injected) return;
    void refresh(injected).catch((reason) =>
      setError(userFacingError(reason, "wallet")),
    );
    const sync = () =>
      void refresh(injected).catch((reason) =>
        setError(userFacingError(reason, "wallet")),
      );
    const emitter = injected as BrowserProvider & {
      on?: (event: string, listener: () => void) => void;
      removeListener?: (event: string, listener: () => void) => void;
    };
    emitter.on?.("accountsChanged", sync);
    emitter.on?.("chainChanged", sync);
    emitter.on?.("disconnect", sync);
    return () => {
      emitter.removeListener?.("accountsChanged", sync);
      emitter.removeListener?.("chainChanged", sync);
      emitter.removeListener?.("disconnect", sync);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    const injected = provider ?? getInjectedProvider();
    if (!injected) {
      const message =
        "Install an injected EIP-1193 wallet such as MetaMask to connect.";
      setError(message);
      throw new Error(message);
    }
    setStatus("connecting");
    setError(undefined);
    try {
      await injected.request({ method: "eth_requestAccounts" });
      await refresh(injected);
    } catch (reason) {
      setStatus("disconnected");
      const message = userFacingError(reason, "wallet");
      setError(message);
      throw new Error(message);
    }
  }, [provider, refresh]);

  const disconnect = useCallback(() => {
    setAddress(undefined);
    setChainId(undefined);
    setStatus("disconnected");
    setError(undefined);
  }, []);

  const switchToStudioNext = useCallback(async () => {
    const injected = provider ?? getInjectedProvider();
    if (!injected) return connect();
    setError(undefined);
    try {
      await switchWallet(injected);
      await refresh(injected);
    } catch (reason) {
      const message = userFacingError(reason, "wallet");
      setError(message);
      throw new Error(message);
    }
  }, [connect, provider, refresh]);

  const kit = useMemo<TransactionKit | undefined>(
    () =>
      provider && address && status === "connected" && COVER_CONFIGURED
        ? createTransactionKit({
            chain: studioNext,
            provider,
            account: address,
          })
        : undefined,
    [address, provider, status],
  );
  const connectedClient = useMemo(
    () =>
      provider && address && status === "connected" && COVER_CONFIGURED
        ? getConnectedClient(provider, address)
        : undefined,
    [address, provider, status],
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      connect,
      disconnect,
      switchToStudioNext,
      ...(address ? { address } : {}),
      ...(chainId === undefined ? {} : { chainId }),
      ...(provider ? { provider } : {}),
      ...(kit ? { kit } : {}),
      ...(connectedClient ? { connectedClient } : {}),
      ...(error ? { error } : {}),
    }),
    [
      address,
      chainId,
      connect,
      connectedClient,
      disconnect,
      error,
      kit,
      provider,
      status,
      switchToStudioNext,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletControl() {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (wallet.status === "connecting") {
    return (
      <button className="button button-quiet" disabled>
        Connecting…
      </button>
    );
  }
  if (wallet.status === "wrong-network") {
    return (
      <button
        className="button button-light"
        onClick={() => void wallet.switchToStudioNext()}
      >
        Switch network
      </button>
    );
  }
  if (wallet.status === "connected" && wallet.address) {
    return (
      <div className="wallet-control">
        <button
          className="wallet-chip"
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          <span className="wallet-dot" />
          {shortAddress(wallet.address)}
        </button>
        {open && (
          <div className="wallet-popover">
            <span className="eyebrow">Connected wallet</span>
            <code>{wallet.address}</code>
            <p>Studio Next · {STUDIO_NEXT_CHAIN_ID}</p>
            <div className="inline-actions">
              <button
                className="button button-small"
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(wallet.address ?? "");
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1200);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                className="button button-small button-quiet"
                type="button"
                onClick={() => {
                  wallet.disconnect();
                  setOpen(false);
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <button
      className="button button-light"
      type="button"
      onClick={() => void wallet.connect()}
    >
      Connect wallet
    </button>
  );
}
