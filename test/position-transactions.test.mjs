import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composeDirectYieldRedeemTransaction,
  decodeUintResult,
  deriveRoutableYieldAssets,
  encodeBalanceOfCalldata,
  encodeConvertToAssetsCalldata,
  encodeConvertToSharesCalldata,
  encodePreviewRedeemCalldata,
  encodeRedeemCalldata,
  requireSuccessfulTransactionReceipt,
} from "../src/position-transactions.mjs";

const FIXTURE_VAULT = "0x1111111111111111111111111111111111111111";
const FIXTURE_MEMBER = "0x2222222222222222222222222222222222222222";
const FIXTURE_POOL = "0x3333333333333333333333333333333333333333";

test("encodeBalanceOfCalldata matches the standard ERC-20 selector and a zero-padded address word", () => {
  assert.equal(
    encodeBalanceOfCalldata({ account: FIXTURE_MEMBER }),
    `0x70a08231${"0".repeat(24)}2222222222222222222222222222222222222222`,
  );
});

test("ERC-4626 read selectors match the standard interface", () => {
  assert.equal(
    encodeConvertToAssetsCalldata({ shares: 1000000n }),
    `0x07a2d13a${(1000000n).toString(16).padStart(64, "0")}`,
  );
  assert.equal(
    encodeConvertToSharesCalldata({ assets: 1000000n }),
    `0xc6e6f592${(1000000n).toString(16).padStart(64, "0")}`,
  );
  assert.equal(
    encodePreviewRedeemCalldata({ shares: 1000000n }),
    `0x4cdad506${(1000000n).toString(16).padStart(64, "0")}`,
  );
});

test("deriveRoutableYieldAssets measures yield in underlying assets, not extra share count", () => {
  assert.equal(deriveRoutableYieldAssets({ redeemableAssets: 1_075_000000n, principalAssets: 1_000_000000n }), 75_000000n);
  assert.equal(deriveRoutableYieldAssets({ redeemableAssets: 999_000000n, principalAssets: 1_000_000000n }), 0n);
});

test("deriveRoutableYieldAssets refuses an unknown, blank, or zero principal basis", () => {
  assert.throws(
    () => deriveRoutableYieldAssets({ redeemableAssets: 1_075_000000n, principalAssets: null }),
    TypeError,
  );
  assert.throws(
    () => deriveRoutableYieldAssets({ redeemableAssets: 1_075_000000n, principalAssets: "" }),
    /greater than zero/u,
  );
  assert.throws(
    () => deriveRoutableYieldAssets({ redeemableAssets: 1_075_000000n, principalAssets: "0" }),
    /greater than zero/u,
  );
});

test("encodeRedeemCalldata permits receiver and owner to differ", () => {
  const calldata = encodeRedeemCalldata({ shares: 42n, receiver: FIXTURE_POOL, owner: FIXTURE_MEMBER });
  const expected = `0xba087652${(42n).toString(16).padStart(64, "0")}${"0".repeat(24)}3333333333333333333333333333333333333333${"0".repeat(24)}2222222222222222222222222222222222222222`;
  assert.equal(calldata, expected);
});

test("direct yield routing is exactly one vault redeem with the pool as receiver and member as owner", () => {
  const transaction = composeDirectYieldRedeemTransaction({
    vaultAddress: FIXTURE_VAULT,
    accruedShares: 100n,
    memberAddress: FIXTURE_MEMBER,
    poolAddress: FIXTURE_POOL,
  });
  assert.equal(transaction.to, FIXTURE_VAULT);
  assert.equal(
    transaction.data,
    encodeRedeemCalldata({ shares: 100n, receiver: FIXTURE_POOL, owner: FIXTURE_MEMBER }),
  );
  assert.match(transaction.description, /directly to Tidepool/u);
});

test("direct routing never composes an ERC-20 transfer from the member wallet", () => {
  const transaction = composeDirectYieldRedeemTransaction({
    vaultAddress: FIXTURE_VAULT,
    accruedShares: 100n,
    memberAddress: FIXTURE_MEMBER,
    poolAddress: FIXTURE_POOL,
  });
  assert.equal(transaction.to, FIXTURE_VAULT);
  assert.ok(!transaction.data.startsWith("0xa9059cbb"));
});

test("successful receipt guard refuses pending and reverted receipts", () => {
  assert.throws(() => requireSuccessfulTransactionReceipt(null), TypeError);
  assert.throws(() => requireSuccessfulTransactionReceipt({ status: "0x0" }), /did not confirm successfully/u);
  const receipt={ status: "0x1", logs: [] };
  assert.equal(requireSuccessfulTransactionReceipt(receipt), receipt);
});

test("direct route refuses malformed or zero-value inputs", () => {
  assert.throws(() => composeDirectYieldRedeemTransaction({
    vaultAddress:FIXTURE_VAULT,accruedShares:0n,memberAddress:FIXTURE_MEMBER,poolAddress:FIXTURE_POOL,
  }),/greater than zero/u);
  assert.throws(() => composeDirectYieldRedeemTransaction({
    vaultAddress:FIXTURE_VAULT,accruedShares:1n,memberAddress:FIXTURE_MEMBER,poolAddress:null,
  }),TypeError);
});

test("decodeUintResult round-trips a uint256 eth_call response", () => {
  const word = (123456789n).toString(16).padStart(64, "0");
  assert.equal(decodeUintResult(`0x${word}`), 123456789n);
});

test("calldata and accounting helpers refuse malformed values", () => {
  assert.throws(() => encodeBalanceOfCalldata({ account: "not-an-address" }), TypeError);
  assert.throws(() => deriveRoutableYieldAssets({ redeemableAssets: -1n, principalAssets: 0n }), TypeError);
});
