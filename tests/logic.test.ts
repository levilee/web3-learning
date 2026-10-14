import assert from "node:assert/strict";
import {
  addressFromPublicKey,
  base58Decode,
  base58Encode,
  createAccount,
  createDidKey,
  describeSignature,
  flipLastCharacter,
  issueCredential,
  presentCredential,
  prove,
  sha256Hex,
  signMessage,
  verifyMessage,
  verifyPresentation,
  verifyProof,
  sha256Of,
  explainTamper,
} from "../src/crypto.ts";
import { issueLabCerts, verifyLeaf } from "../src/cert.ts";
import {
  applyBlock,
  buildTx,
  CONTRACT,
  createGenesis,
  fundLearner,
  namedAccounts,
  verifyTx,
} from "../src/ledger.ts";
import { hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

const original = "运维交接：证书在 4 月 2 日到期";
const changed = flipLastCharacter(original);
assert.notEqual(sha256Hex(original), sha256Hex(changed));

const account = createAccount();
const signature = signMessage(original, account.secretKeyHex);
assert.equal(verifyMessage(original, signature, account.publicKeyHex), true);
assert.equal(verifyMessage(changed, signature, account.publicKeyHex), false);
assert.equal(explainTamper(original, changed, signature, account.publicKeyHex).reason, "消息已改变");
{
  const raw = utf8ToBytes(original);
  const flipped = new Uint8Array(raw);
  flipped[flipped.length - 1] ^= 0x01;
  assert.notEqual(sha256Of(raw), sha256Of(flipped));
}
assert.equal(addressFromPublicKey(hexToBytes(account.publicKeyHex)), account.address);
assert.match(account.address, /^0x[0-9a-f]{40}$/);

const leaves = ["a", "b", "c", "d"];
const proof = prove(leaves, 2);
assert.equal(verifyProof(leaves[2], proof.proof, proof.root), true);
assert.equal(verifyProof("c!", proof.proof, proof.root), false);
assert.equal(verifyProof("only", prove(["only"], 0).proof, prove(["only"], 0).root), true);

const encoded = base58Encode(new Uint8Array([0, 1, 2, 255]));
assert.deepEqual(base58Decode(encoded), new Uint8Array([0, 1, 2, 255]));

const genesis = createGenesis();
assert.equal(genesis.blocks.length, 1);
assert.equal(genesis.blocks[0].leaves.length, 4);
assert.equal(verifyTx(genesis.txs[0]).ok, true);
const { alice, bob } = namedAccounts();
assert.equal(genesis.accounts[alice.address].balance, 55);
assert.equal(genesis.accounts[bob.address].balance, 35);

const learner = createAccount();
const funded = fundLearner(genesis, learner);
assert.equal(funded.accounts[learner.address].balance, 100);

const good = buildTx(funded, learner, { to: bob.address, value: 1, data: "" });
const accepted = applyBlock(funded, [good]);
assert.equal(accepted.ok, true);
if (!accepted.ok) throw new Error("accepted");
assert.equal(accepted.ledger.accounts[learner.address].balance, 99);
assert.equal(accepted.ledger.accounts[learner.address].nonce, 1);

const badNonce = buildTx(accepted.ledger, learner, { to: bob.address, value: 1, data: "", nonce: 9 });
const nonceResult = applyBlock(accepted.ledger, [badNonce]);
assert.equal(nonceResult.ok, false);
if (nonceResult.ok) throw new Error("nonce");
assert.match(nonceResult.reason, /nonce/);

const tooMuch = buildTx(accepted.ledger, learner, { to: bob.address, value: 500, data: "" });
const balanceResult = applyBlock(accepted.ledger, [tooMuch]);
assert.equal(balanceResult.ok, false);
if (balanceResult.ok) throw new Error("balance");
assert.match(balanceResult.reason, /余额不足/);

const transfer = buildTx(accepted.ledger, learner, { to: bob.address, value: 1, data: "" });
const afterTransfer = applyBlock(accepted.ledger, [transfer]);
assert.equal(afterTransfer.ok, true);
if (!afterTransfer.ok) throw new Error("transfer");
assert.equal(afterTransfer.ledger.storage.count, 0);

const call = buildTx(afterTransfer.ledger, learner, { to: CONTRACT, value: 0, data: "setCount:4" });
const afterCall = applyBlock(afterTransfer.ledger, [call]);
assert.equal(afterCall.ok, true);
if (!afterCall.ok) throw new Error("call");
assert.equal(afterCall.ledger.storage.count, 4);
assert.equal(call.data, "setCount:4");
assert.equal(transfer.data, "");

const issuer = createDidKey();
const holder = createDidKey();
assert.match(issuer.did, /^did:key:z/);
const now = new Date("2026-10-14T00:00:00Z");
const valid = presentCredential(holder, issueCredential({
  issuer,
  subjectDid: holder.did,
  name: "Lee",
  role: "ops",
  validFrom: "2026-10-01T00:00:00.000Z",
  validUntil: "2026-12-01T00:00:00.000Z",
  id: "urn:uuid:valid",
}));
assert.equal(verifyPresentation({ presentation: valid, issuer, holder, now, requiredClaim: "role", revokedIds: [] }).ok, true);

const expired = presentCredential(holder, issueCredential({
  issuer,
  subjectDid: holder.did,
  name: "Lee",
  role: "ops",
  validFrom: "2020-01-01T00:00:00.000Z",
  validUntil: "2020-02-01T00:00:00.000Z",
  id: "urn:uuid:expired",
}));
assert.match(verifyPresentation({ presentation: expired, issuer, holder, now, requiredClaim: "role", revokedIds: [] }).reason, /有效期/);

const missing = presentCredential(holder, issueCredential({
  issuer,
  subjectDid: holder.did,
  name: "Lee",
  validFrom: "2026-10-01T00:00:00.000Z",
  validUntil: "2026-12-01T00:00:00.000Z",
  id: "urn:uuid:missing",
}));
assert.match(verifyPresentation({ presentation: missing, issuer, holder, now, requiredClaim: "role", revokedIds: [] }).reason, /role/);

const revoked = presentCredential(holder, issueCredential({
  issuer,
  subjectDid: holder.did,
  name: "Lee",
  role: "ops",
  validFrom: "2026-10-01T00:00:00.000Z",
  validUntil: "2026-12-01T00:00:00.000Z",
  id: "urn:uuid:revoked",
}));
assert.match(
  verifyPresentation({ presentation: revoked, issuer, holder, now, requiredClaim: "role", revokedIds: ["urn:uuid:revoked"] }).reason,
  /状态名单/,
);

const described = describeSignature(original, signature, account.publicKeyHex);
assert.equal(described.byteLength, 64);
assert.equal(described.r.length, 64);
assert.equal(described.s.length, 64);
assert.equal(described.digest, sha256Hex(original));
assert.equal(described.hashAlgorithm, "SHA-256");
assert.equal(described.signatureAlgorithm, "ECDSA");
assert.equal(described.curve, "secp256k1");
assert.equal(described.ok, true);

const material = await issueLabCerts();
const ok = await verifyLeaf(material.leafPem, material.caPem, []);
const wrong = await verifyLeaf(material.leafPem, material.otherCaPem, []);
const revokedCert = await verifyLeaf(material.leafPem, material.caPem, [material.leafSerial]);
assert.equal(ok.ok, true);
assert.equal(ok.steps.at(-1)?.ok, true);
assert.equal(wrong.ok, false);
assert.equal(wrong.steps[2]?.ok, false);
assert.match(wrong.reason, /签名验证失败/);
assert.equal(revokedCert.ok, false);
assert.match(revokedCert.steps.at(-1)?.body ?? "", /序列号/);
assert.match(revokedCert.reason, /吊销名单/);
assert.match(material.leafPem, /BEGIN CERTIFICATE/);

console.log("logic tests passed");
