import {
  type AccountKey,
  accountFromSecretHex,
  addressFromPublicKey,
  merkle,
  signMessage,
  verifyMessage,
} from "./crypto";
import { hexToBytes } from "@noble/hashes/utils.js";

export const CONTRACT = "0x00000000000000000000000000000000000000c0";
export const FAUCET_SECRET = "0000000000000000000000000000000000000000000000000000000000000001";
export const ALICE_SECRET = "0000000000000000000000000000000000000000000000000000000000000002";
export const BOB_SECRET = "0000000000000000000000000000000000000000000000000000000000000003";

export type TxBody = {
  from: string;
  to: string;
  value: number;
  nonce: number;
  data: string;
};

export type Tx = TxBody & {
  signature: string;
  publicKey: string;
};

export type Account = {
  balance: number;
  nonce: number;
};

export type Block = {
  index: number;
  leaves: string[];
  root: string;
};

export type Ledger = {
  accounts: Record<string, Account>;
  txs: Tx[];
  blocks: Block[];
  storage: { count: number };
};

export function namedAccounts() {
  return {
    faucet: accountFromSecretHex(FAUCET_SECRET),
    alice: accountFromSecretHex(ALICE_SECRET),
    bob: accountFromSecretHex(BOB_SECRET),
  };
}

export function txMessage(tx: TxBody): string {
  return ["tx", tx.from, tx.to, String(tx.value), String(tx.nonce), tx.data].join("|");
}

export function signTx(tx: TxBody, signer: AccountKey): Tx {
  return {
    ...tx,
    signature: signMessage(txMessage(tx), signer.secretKeyHex),
    publicKey: signer.publicKeyHex,
  };
}

export function txLeaf(tx: Tx): string {
  return txMessage(tx);
}

export function verifyTx(tx: Tx): { ok: true } | { ok: false; reason: string } {
  let derived = "";
  try {
    derived = addressFromPublicKey(hexToBytes(tx.publicKey));
  } catch {
    return { ok: false, reason: "公钥无法解析。" };
  }
  if (derived !== tx.from) return { ok: false, reason: "公钥推导出的地址和 from 不一致。" };
  if (!verifyMessage(txMessage(tx), tx.signature, tx.publicKey)) return { ok: false, reason: "签名对不上。" };
  return { ok: true };
}

function clone(ledger: Ledger): Ledger {
  return {
    accounts: Object.fromEntries(Object.entries(ledger.accounts).map(([key, account]) => [key, { ...account }])),
    txs: ledger.txs.map((tx) => ({ ...tx })),
    blocks: ledger.blocks.map((block) => ({ ...block, leaves: [...block.leaves] })),
    storage: { ...ledger.storage },
  };
}

export function emptyLedger(): Ledger {
  const { faucet, alice, bob } = namedAccounts();
  return {
    accounts: {
      [faucet.address]: { balance: 1000, nonce: 0 },
      [alice.address]: { balance: 0, nonce: 0 },
      [bob.address]: { balance: 0, nonce: 0 },
      [CONTRACT]: { balance: 0, nonce: 0 },
    },
    txs: [],
    blocks: [],
    storage: { count: 0 },
  };
}

export function applyBlock(ledger: Ledger, txs: Tx[]): { ok: true; ledger: Ledger } | { ok: false; reason: string } {
  const next = clone(ledger);
  for (const tx of txs) {
    const signature = verifyTx(tx);
    if (!signature.ok) return signature;
    const sender = next.accounts[tx.from];
    if (!sender) return { ok: false, reason: "付款账户不在账本里。" };
    if (tx.nonce !== sender.nonce) {
      return { ok: false, reason: `nonce 不正确：账本等待 ${sender.nonce}，交易写的是 ${tx.nonce}。` };
    }
    if (!Number.isInteger(tx.value) || tx.value < 0) return { ok: false, reason: "金额不合法。" };
    if (sender.balance < tx.value) {
      return { ok: false, reason: `余额不足：余额 ${sender.balance}，转账 ${tx.value}。` };
    }
    sender.balance -= tx.value;
    sender.nonce += 1;
    const recipient = next.accounts[tx.to] ?? { balance: 0, nonce: 0 };
    recipient.balance += tx.value;
    next.accounts[tx.to] = recipient;
    if (tx.to === CONTRACT && tx.data.startsWith("setCount:")) {
      const count = Number(tx.data.slice("setCount:".length));
      if (!Number.isInteger(count)) return { ok: false, reason: "setCount 的参数不是整数。" };
      next.storage.count = count;
    }
    next.txs.push(tx);
  }
  const leaves = txs.map((tx) => txLeaf(tx));
  next.blocks.push({ index: next.blocks.length, leaves, root: merkle(leaves).root });
  return { ok: true, ledger: next };
}

export function createGenesis(): Ledger {
  const { faucet, alice, bob } = namedAccounts();
  const first = applyBlock(emptyLedger(), [
    signTx({ from: faucet.address, to: alice.address, value: 50, nonce: 0, data: "" }, faucet),
    signTx({ from: faucet.address, to: bob.address, value: 30, nonce: 1, data: "" }, faucet),
    signTx({ from: faucet.address, to: alice.address, value: 10, nonce: 2, data: "" }, faucet),
    signTx({ from: alice.address, to: bob.address, value: 5, nonce: 0, data: "genesis-memo" }, alice),
  ]);
  if (!first.ok) throw new Error(first.reason);
  return first.ledger;
}

export function fundLearner(ledger: Ledger, learner: AccountKey): Ledger {
  if (ledger.accounts[learner.address]) return ledger;
  const faucet = accountFromSecretHex(FAUCET_SECRET);
  const faucetAccount = ledger.accounts[faucet.address];
  const funded = applyBlock(ledger, [
    signTx(
      { from: faucet.address, to: learner.address, value: 100, nonce: faucetAccount.nonce, data: "faucet" },
      faucet,
    ),
  ]);
  if (!funded.ok) throw new Error(funded.reason);
  return funded.ledger;
}

export function buildTx(ledger: Ledger, signer: AccountKey, body: Omit<TxBody, "from" | "nonce"> & { nonce?: number }): Tx {
  const nonce = body.nonce ?? ledger.accounts[signer.address]?.nonce ?? 0;
  return signTx({ from: signer.address, to: body.to, value: body.value, nonce, data: body.data }, signer);
}
