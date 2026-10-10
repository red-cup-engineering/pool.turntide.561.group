/**
 * The "your position" page's browser client. Connects to `window.ethereum` (EIP-1193) only —
 * no third-party wallet SDK and no custodial path. It compares the fee-aware redeemable value
 * of the member's shares with a principal amount the member records locally in USDC units.
 *
 * ERC-4626 yield normally increases assets-per-share rather than minting new shares. Routing
 * is one atomic redeem: the member owns the shares being burned, while Tidepool's pool address
 * is the ERC-4626 receiver of the resulting USDC.
 */
import {
  composeDirectYieldRedeemTransaction,
  decodeUintResult,
  deriveRoutableYieldAssets,
  encodeBalanceOfCalldata,
  encodeConvertToSharesCalldata,
  encodePreviewRedeemCalldata,
  requireSuccessfulTransactionReceipt,
} from "./position-transactions.mjs";

const config = JSON.parse(document.getElementById("tidepool-position-config").textContent);
const walletStatus = document.getElementById("wallet-status");
const connectButton = document.getElementById("connect-wallet");
const principalInput = document.getElementById("principal-input");
const saveButton = document.getElementById("save-principal");
const routeButton = document.getElementById("route-yield");
const routeStatus = document.getElementById("route-status");
const readout = {
  shares: document.getElementById("readout-shares"),
  assets: document.getElementById("readout-assets"),
  usdc: document.getElementById("readout-usdc"),
  accrued: document.getElementById("readout-accrued"),
};

const USDC_DECIMALS = 6n;
const USDC_SCALE = 10n ** USDC_DECIMALS;
const PRINCIPAL_KEY = "tidepool-recorded-principal-usdc-units";
const LEGACY_PRINCIPAL_KEY = "tidepool-recorded-principal-shares";
const RECEIPT_POLL_MS = 1000;
const RECEIPT_POLL_ATTEMPTS = 180;
let account = null;

function chainIdHex() {
  return `0x${config.chainId.toString(16)}`;
}

function formatUsdc(units) {
  const value = BigInt(units);
  const whole = value / USDC_SCALE;
  const fraction = (value % USDC_SCALE).toString().padStart(Number(USDC_DECIMALS), "0").replace(/0+$/u, "");
  return fraction.length === 0 ? whole.toString() : `${whole}.${fraction}`;
}

function parseUsdc(value) {
  const match = /^(\d+)(?:\.(\d{0,6}))?$/u.exec(value.trim());
  if (match === null) throw new TypeError("Principal must be a non-negative USDC amount with at most 6 decimal places.");
  const fraction = (match[2] ?? "").padEnd(Number(USDC_DECIMALS), "0");
  return BigInt(match[1]) * USDC_SCALE + BigInt(fraction || "0");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function ethCall(to, data) {
  return window.ethereum.request({ method: "eth_call", params: [{ to, data }, "latest"] });
}

async function waitForReceipt(transactionHash) {
  for (let attempt = 0; attempt < RECEIPT_POLL_ATTEMPTS; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop -- a receipt exists only after a later block.
    const receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [transactionHash] });
    if (receipt !== null) return receipt;
    // eslint-disable-next-line no-await-in-loop -- bounded polling is intentional.
    await sleep(RECEIPT_POLL_MS);
  }
  throw new Error(`Timed out waiting for transaction receipt: ${transactionHash}`);
}

async function ensureBaseChain() {
  const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
  if (currentChainId === chainIdHex()) return;
  await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex() }] });
}

function recordedPrincipalAssets() {
  const stored = localStorage.getItem(PRINCIPAL_KEY);
  if (stored === null || stored.trim() === "") return null;
  try {
    const principal = BigInt(stored);
    return principal > 0n ? principal : null;
  } catch {
    return null;
  }
}

function syncRoutingAvailability() {
  routeButton.disabled = (
    config.poolAddress === null
    || config.vaults.length === 0
    || account === null
    || recordedPrincipalAssets() === null
  );
}

async function connect() {
  if (!window.ethereum) {
    walletStatus.textContent = "No EIP-1193 wallet found in this browser.";
    return;
  }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  account = accounts[0] ?? null;
  if (account === null) {
    walletStatus.textContent = "No account returned by wallet.";
    return;
  }
  await ensureBaseChain();
  walletStatus.textContent = `Connected: ${account}`;
  const storedPrincipal = localStorage.getItem(PRINCIPAL_KEY);
  const rememberedPrincipal = recordedPrincipalAssets();
  principalInput.value = rememberedPrincipal === null ? "" : formatUsdc(rememberedPrincipal);
  if (storedPrincipal !== null && rememberedPrincipal === null) {
    walletStatus.textContent += " The stored principal is blank, malformed, or zero; re-enter a positive principal in USDC before Tidepool can calculate or route yield.";
  } else if (storedPrincipal === null && localStorage.getItem(LEGACY_PRINCIPAL_KEY) !== null) {
    walletStatus.textContent += " An older share-based principal note exists; re-enter principal in USDC because share counts do not measure ERC-4626 yield.";
  }
  await refreshPosition();
}

async function readVaultPosition(vault) {
  const sharesHex = await ethCall(vault, encodeBalanceOfCalldata({ account }));
  const shares = decodeUintResult(sharesHex);
  const redeemableHex = await ethCall(vault, encodePreviewRedeemCalldata({ shares }));
  const redeemableAssets = decodeUintResult(redeemableHex);
  return { shares, redeemableAssets };
}

async function refreshPosition() {
  if (account === null || config.vaults.length === 0) {
    if (config.vaults.length === 0) readout.shares.textContent = "No standing vault recorded yet in tidepool.json.";
    syncRoutingAvailability();
    return;
  }
  const vault = config.vaults[0].address;
  const { shares, redeemableAssets } = await readVaultPosition(vault);
  readout.shares.textContent = shares.toString();
  readout.assets.textContent = `${formatUsdc(redeemableAssets)} USDC (${redeemableAssets} base units)`;
  const usdcHex = await ethCall(config.usdc, encodeBalanceOfCalldata({ account }));
  const usdcBalance = decodeUintResult(usdcHex);
  readout.usdc.textContent = `${formatUsdc(usdcBalance)} USDC`;
  const principal = recordedPrincipalAssets();
  if (principal === null) {
    readout.accrued.textContent = "Unknown — record principal in USDC before Tidepool can calculate or route yield.";
    syncRoutingAvailability();
    return;
  }
  const accruedAssets = deriveRoutableYieldAssets({ redeemableAssets, principalAssets: principal });
  readout.accrued.textContent = `${formatUsdc(accruedAssets)} USDC above your recorded principal`;
  syncRoutingAvailability();
}

function savePrincipal() {
  try {
    const units = parseUsdc(principalInput.value);
    if (units === 0n) throw new TypeError("Principal must be greater than zero USDC.");
    localStorage.setItem(PRINCIPAL_KEY, units.toString());
    walletStatus.textContent = `Principal saved locally as ${formatUsdc(units)} USDC.`;
    refreshPosition().catch((error) => { walletStatus.textContent = `Error: ${error.message}`; });
  } catch (error) {
    walletStatus.textContent = error.message;
  }
}

async function routeYield() {
  if (config.poolAddress === null || config.vaults.length === 0 || account === null) return;
  const principal = recordedPrincipalAssets();
  if (principal === null) {
    routeStatus.textContent = "Record principal in USDC before Tidepool can calculate or route yield.";
    syncRoutingAvailability();
    return;
  }
  routeButton.disabled = true;
  try {
    const vault = config.vaults[0].address;
    const { redeemableAssets } = await readVaultPosition(vault);
    const accruedAssets = deriveRoutableYieldAssets({ redeemableAssets, principalAssets: principal });
    if (accruedAssets === 0n) {
      routeStatus.textContent = "No redeemable USDC above your recorded principal.";
      return;
    }

    // convertToShares rounds down under ERC-4626. This picks no more shares than the current
    // asset-denominated yield estimate calls for.
    const sharesHex = await ethCall(vault, encodeConvertToSharesCalldata({ assets: accruedAssets }));
    const accruedShares = decodeUintResult(sharesHex);
    if (accruedShares === 0n) {
      routeStatus.textContent = "Accrued yield is below one redeemable share at the current vault price.";
      return;
    }

    // previewRedeem is only a current-block estimate shown before signing. The actual booked
    // receipt comes from the confirmed transaction / pool reconciliation.
    const previewHex = await ethCall(vault, encodePreviewRedeemCalldata({ shares: accruedShares }));
    const previewAssets = decodeUintResult(previewHex);
    if (previewAssets === 0n) {
      routeStatus.textContent = "The conservative yield share count currently previews to zero redeemable USDC.";
      return;
    }

    const transaction = composeDirectYieldRedeemTransaction({
      vaultAddress: vault,
      accruedShares,
      memberAddress: account,
      poolAddress: config.poolAddress,
    });
    routeStatus.textContent = `Sign one atomic redeem of about ${formatUsdc(previewAssets)} USDC directly to Tidepool. Your unrelated wallet USDC is not touched.`;
    const transactionHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: account, to: transaction.to, data: transaction.data }],
    });

    routeStatus.textContent = `Direct redeem submitted (${transactionHash}); waiting for confirmation.`;
    const receipt = await waitForReceipt(transactionHash);
    requireSuccessfulTransactionReceipt(receipt);
    routeStatus.textContent = `Confirmed direct Tidepool routing transaction: ${transactionHash}. The displayed amount was a pre-sign estimate; the cycle books reconcile the actual on-chain receipt.`;
    await refreshPosition();
  } catch (error) {
    routeStatus.textContent = `Stopped: ${error.message}. No separate USDC transfer is ever submitted.`;
  } finally {
    syncRoutingAvailability();
  }
}

connectButton.addEventListener("click", () => { connect().catch((error) => { walletStatus.textContent = `Error: ${error.message}`; }); });
saveButton.addEventListener("click", savePrincipal);
routeButton.addEventListener("click", () => { routeYield().catch((error) => { routeStatus.textContent = `Error: ${error.message}`; }); });
