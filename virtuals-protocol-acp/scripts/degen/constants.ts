/**
 * Provider wallets on ACP for Degen Claw (HL / leaderboard) and dgclaw-subscription.
 * Same addresses as the reference wolfy-agent/virtuals-agent integration.
 */
export const DEGEN_CLAW_PROVIDER =
  "0xd478a8B40372db16cA8045F28C6FE07228F3781A" as const;

/** dgclaw-subscription seller wallet. */
export const DGCLAW_SUBSCRIPTION_PROVIDER =
  "0xC751AF68b3041eDc01d4A0b5eC4BFF2Bf07Bae73" as const;

/** Forum token used in subscribe jobs (override via env FORUM_TOKEN_ADDRESS if needed). */
export const DEFAULT_FORUM_TOKEN_ADDRESS =
  "0xfC338BB6E31d2190501dC567CdAa7AB5A72544fD" as const;

/** HL subaccount for Degen perp deposit/withdraw (override with HL_SUBACCOUNT_ADDRESS). */
export const DEFAULT_HL_SUBACCOUNT =
  "0xbf8e97ddf1d411c3a5c415bd5c219d86f31ad4d3" as const;
