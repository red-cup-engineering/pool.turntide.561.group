/**
 * Pure EVM calldata composition and yield-accounting helpers for the "your position" page.
 * No `node:` import: this exact file runs unmodified in Node tests and in the browser.
 *
 * ERC-4626 shares represent claims on underlying assets. Yield normally appears as more
 * redeemable assets per share, not as extra shares, so principal/yield comparisons are made
 * in underlying-asset units.
 *
 * Routing uses one atomic member-signed ERC-4626 redeem. The member remains `owner` of the
 * burned vault shares while Tidepool's pool address is the redeem `receiver`. The underlying
 * USDC therefore moves vault -> pool inside that single transaction and can never sweep an
 * unrelated USDC balance from the member wallet.
 */

const SELECTORS = Object.freeze({
  balanceOf: "0x70a08231",
  convertToAssets: "0x07a2d13a",
  convertToShares: "0xc6e6f592",
  previewRedeem: "0x4cdad506",
  redeem: "0xba087652",
});

/** @throws {TypeError} if `address` is not a syntactically valid EVM address. */
function requireAddress(name, address) {
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/u.test(address)) {
    throw new TypeError(`position-transactions: ${name} must be a 0x-prefixed 40-hex-digit address, got ${JSON.stringify(address)}`);
  }
  return address.toLowerCase();
}

/** @throws {TypeError} if `value` cannot become a non-negative BigInt. */
function requireUint(name, value) {
  let big;
  try {
    big = typeof value === "bigint" ? value : BigInt(value);
  } catch {
    throw new TypeError(`position-transactions: ${name} must be an integer or bigint-parsable string, got ${JSON.stringify(value)}`);
  }
  if (big < 0n) throw new TypeError(`position-transactions: ${name} must be non-negative`);
  return big;
}

function addressWord(address) {
  return requireAddress("address", address).slice(2).padStart(64, "0");
}

function uintWord(value) {
  return requireUint("value", value).toString(16).padStart(64, "0");
}

export function encodeBalanceOfCalldata({ account }) {
  return `${SELECTORS.balanceOf}${addressWord(account)}`;
}

export function encodeConvertToAssetsCalldata({ shares }) {
  return `${SELECTORS.convertToAssets}${uintWord(shares)}`;
}

/**
 * ERC-4626 requires convertToShares to round down. For the current yield estimate that makes
 * the chosen share count conservative rather than intentionally crossing above it.
 */
export function encodeConvertToSharesCalldata({ assets }) {
  return `${SELECTORS.convertToShares}${uintWord(assets)}`;
}

/**
 * Fee-aware, current-block estimate used for display/pre-sign review. It is not an oracle and
 * is not presented as the eventual booked cycle amount.
 */
export function encodePreviewRedeemCalldata({ shares }) {
  return `${SELECTORS.previewRedeem}${uintWord(shares)}`;
}

export function encodeRedeemCalldata({ shares, receiver, owner }) {
  return `${SELECTORS.redeem}${uintWord(shares)}${addressWord(receiver)}${addressWord(owner)}`;
}

export function deriveRoutableYieldAssets({ redeemableAssets, principalAssets }) {
  const redeemable = requireUint("redeemableAssets", redeemableAssets);
  const principal = requireUint("principalAssets", principalAssets);
  if (principal === 0n) {
    throw new TypeError("position-transactions: principalAssets must be greater than zero");
  }
  return redeemable > principal ? redeemable - principal : 0n;
}

/**
 * One atomic routing transaction: burn the member owner's conservative yield-share count and
 * make the pool the ERC-4626 receiver of the underlying assets.
 */
export function composeDirectYieldRedeemTransaction({ vaultAddress, accruedShares, memberAddress, poolAddress }) {
  const owner = requireAddress("memberAddress", memberAddress);
  const receiver = requireAddress("poolAddress", poolAddress);
  const shares = requireUint("accruedShares", accruedShares);
  if (shares === 0n) throw new TypeError("position-transactions: accruedShares must be greater than zero");
  return Object.freeze({
    to: requireAddress("vaultAddress", vaultAddress),
    data: encodeRedeemCalldata({ shares, receiver, owner }),
    description: "Redeem this cycle's conservatively derived yield shares directly to Tidepool's pool address.",
  });
}

/**
 * Refuses a missing, pending, or reverted EVM receipt.
 */
export function requireSuccessfulTransactionReceipt(receipt) {
  if (receipt === null || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new TypeError("position-transactions: transaction receipt must be an object");
  }
  if (receipt.status !== "0x1") {
    throw new Error(`position-transactions: transaction did not confirm successfully (status ${JSON.stringify(receipt.status)})`);
  }
  return receipt;
}

export function decodeUintResult(hexResult) {
  if (typeof hexResult !== "string" || !/^0x[0-9a-fA-F]*$/u.test(hexResult)) {
    throw new TypeError(`position-transactions: hexResult must be a 0x-prefixed hex string, got ${JSON.stringify(hexResult)}`);
  }
  const word = hexResult.slice(2, 66).padStart(64, "0");
  return BigInt(`0x${word || "0"}`);
}
