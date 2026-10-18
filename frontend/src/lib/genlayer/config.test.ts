import { describe, expect, it } from "vitest";
import {
  COVER_CONFIGURED,
  COVER_CONTRACT_ADDRESS,
  COVER_QUERY_SCOPE,
  OFFICIAL_COVER_CONTRACT_ADDRESS,
  STUDIO_NEXT_CHAIN_ID,
  STUDIO_NEXT_RPC_URL,
} from "./config";

describe("deployed COVER configuration", () => {
  it("uses the official Studio Next deployment", () => {
    expect(COVER_CONFIGURED).toBe(true);
    expect(COVER_CONTRACT_ADDRESS?.toLowerCase()).toBe(
      "0x0982ebee0aa80ed50c51903186ae5765e06879d8",
    );
    expect(COVER_CONTRACT_ADDRESS).toBe(OFFICIAL_COVER_CONTRACT_ADDRESS);
    expect(COVER_QUERY_SCOPE).toEqual([
      "cover",
      "deployment",
      61997,
      "https://studio-next.genlayer.com/api",
      "0x0982ebee0aa80ed50c51903186ae5765e06879d8",
    ]);
    expect(STUDIO_NEXT_CHAIN_ID).toBe(61997);
    expect(STUDIO_NEXT_RPC_URL).toBe("https://studio-next.genlayer.com/api");
  });
});
