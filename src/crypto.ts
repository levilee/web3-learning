import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { ed25519 } from "@noble/curves/ed25519.js";

export type AccountKey = {
  secretKeyHex: string;
  publicKeyHex: string;
  address: string;
};

export type ProofStep = {
  hash: string;
  side: "left" | "right";
};

export function sha256Hex(text: string): string {
  return bytesToHex(sha256(utf8ToBytes(text)));
}

export function flipLastCharacter(text: string): string {
  if (text.length === 0) return "a";
  const last = text[text.length - 1];
  const next = last === "a" ? "b" : "a";
  return text.slice(0, -1) + next;
}

export function accountFromSecret(secret: Uint8Array): AccountKey {
  const publicKey = secp256k1.getPublicKey(secret, false);
  return {
    secretKeyHex: bytesToHex(secret),
    publicKeyHex: bytesToHex(publicKey),
    address: addressFromPublicKey(publicKey),
  };
}

export function createAccount(): AccountKey {
  const { secretKey } = secp256k1.keygen();
  return accountFromSecret(secretKey);
}

export function accountFromSecretHex(secretKeyHex: string): AccountKey {
  return accountFromSecret(hexToBytes(secretKeyHex));
}

/** Address: last 20 bytes of keccak256(uncompressed public key without the 0x04 prefix). */
export function publicKeyDigest(publicKey: Uint8Array): { digestHex: string; address: string } {
  const raw = publicKey.length === 65 && publicKey[0] === 0x04 ? publicKey.subarray(1) : publicKey;
  const digestHex = bytesToHex(keccak_256(raw));
  return { digestHex, address: `0x${digestHex.slice(-40)}` };
}

export function addressFromPublicKey(publicKey: Uint8Array): string {
  return publicKeyDigest(publicKey).address;
}

export function sha256Of(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

export function explainTamper(
  original: string,
  tampered: string,
  signatureHex: string,
  publicKeyHex: string,
): { ok: boolean; reason: string } {
  const originalOk = verifyMessage(original, signatureHex, publicKeyHex);
  const tamperedOk = verifyMessage(tampered, signatureHex, publicKeyHex);
  if (tamperedOk) return { ok: true, reason: "篡改后的文字仍然通过了验证。" };
  if (originalOk && original !== tampered) return { ok: false, reason: "消息已改变" };
  return { ok: false, reason: "签名或公钥无效。" };
}

export function signMessage(message: string, secretKeyHex: string): string {
  const signature = secp256k1.sign(utf8ToBytes(message), hexToBytes(secretKeyHex));
  return bytesToHex(signature);
}

export function splitCompactSignature(signatureHex: string): { byteLength: number; r: string; s: string } {
  if (signatureHex.length !== 128) throw new Error(`expected 64-byte compact signature, got ${signatureHex.length / 2} bytes`);
  return { byteLength: 64, r: signatureHex.slice(0, 64), s: signatureHex.slice(64) };
}

export function describeSignature(message: string, signatureHex: string, publicKeyHex: string) {
  const parts = splitCompactSignature(signatureHex);
  return {
    messageBytes: utf8ToBytes(message).length,
    digest: sha256Hex(message),
    hashAlgorithm: "SHA-256" as const,
    signatureAlgorithm: "ECDSA" as const,
    curve: "secp256k1" as const,
    encoding: "compact r||s" as const,
    ...parts,
    ok: verifyMessage(message, signatureHex, publicKeyHex),
  };
}

export function verifyMessage(message: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    return secp256k1.verify(hexToBytes(signatureHex), utf8ToBytes(message), hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

export function merkle(leaves: string[]): { root: string; layers: string[][] } {
  if (leaves.length === 0) {
    const root = sha256Hex("");
    return { root, layers: [[root]] };
  }
  let level = leaves.map((leaf) => sha256Hex(leaf));
  const layers = [level];
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(sha256Hex(left + right));
    }
    level = next;
    layers.push(level);
  }
  return { root: level[0], layers };
}

export function prove(leaves: string[], index: number): { root: string; proof: ProofStep[]; leafHash: string } {
  const { root, layers } = merkle(leaves);
  const proof: ProofStep[] = [];
  let cursor = index;
  for (let layer = 0; layer < layers.length - 1; layer += 1) {
    const level = layers[layer];
    const isRight = cursor % 2 === 1;
    const siblingIndex = isRight ? cursor - 1 : cursor + 1;
    const sibling = level[siblingIndex] ?? level[cursor];
    proof.push({ hash: sibling, side: isRight ? "left" : "right" });
    cursor = Math.floor(cursor / 2);
  }
  return { root, proof, leafHash: layers[0][index] };
}

export function verifyProof(leaf: string, proof: ProofStep[], root: string): boolean {
  let acc = sha256Hex(leaf);
  for (const step of proof) {
    acc = step.side === "left" ? sha256Hex(step.hash + acc) : sha256Hex(acc + step.hash);
  }
  return acc === root;
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += BASE58[digits[i]];
  return out;
}

export type DidKey = {
  secretKeyHex: string;
  publicKeyHex: string;
  did: string;
};

export function createDidKey(): DidKey {
  const { secretKey, publicKey } = ed25519.keygen();
  return didFromPair(secretKey, publicKey);
}

function didFromPair(secretKey: Uint8Array, publicKey: Uint8Array): DidKey {
  const prefixed = new Uint8Array(publicKey.length + 2);
  prefixed[0] = 0xed;
  prefixed[1] = 0x01;
  prefixed.set(publicKey, 2);
  const fingerprint = `z${base58Encode(prefixed)}`;
  return {
    secretKeyHex: bytesToHex(secretKey),
    publicKeyHex: bytesToHex(publicKey),
    did: `did:key:${fingerprint}`,
  };
}

export function verificationMethod(did: string): string {
  const fingerprint = did.slice("did:key:".length);
  return `${did}#${fingerprint}`;
}

function jcs(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => jcs(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${jcs(item)}`).join(",")}}`;
}

export type Proof = {
  type: "Ed25519Signature2020";
  verificationMethod: string;
  proofPurpose: "assertionMethod" | "authentication";
  proofValue: string;
};

export type CredentialSubject = {
  id: string;
  name?: string;
  role?: string;
};

export type VerifiableCredential = {
  "@context": ["https://www.w3.org/ns/credentials/v2"];
  type: ["VerifiableCredential"];
  id: string;
  issuer: string;
  validFrom: string;
  validUntil: string;
  credentialSubject: CredentialSubject;
  proof?: Proof;
};

export type VerifiablePresentation = {
  "@context": ["https://www.w3.org/ns/credentials/v2"];
  type: ["VerifiablePresentation"];
  holder: string;
  verifiableCredential: VerifiableCredential[];
  proof?: Proof;
};

function signProof(payload: unknown, secretKeyHex: string, method: string, purpose: Proof["proofPurpose"]): Proof {
  const signature = ed25519.sign(utf8ToBytes(jcs(payload)), hexToBytes(secretKeyHex));
  return {
    type: "Ed25519Signature2020",
    verificationMethod: method,
    proofPurpose: purpose,
    proofValue: `z${base58Encode(signature)}`,
  };
}

function verifyDataProof(payload: unknown, proof: Proof, publicKeyHex: string): boolean {
  if (!proof.proofValue.startsWith("z")) return false;
  const signature = base58Decode(proof.proofValue.slice(1));
  try {
    return ed25519.verify(signature, utf8ToBytes(jcs(payload)), hexToBytes(publicKeyHex), { zip215: true });
  } catch {
    return false;
  }
}

export function base58Decode(text: string): Uint8Array {
  const bytes = [0];
  for (const char of text) {
    const value = BASE58.indexOf(char);
    if (value < 0) throw new Error("base58");
    let carry = value;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let zeros = 0;
  while (zeros < text.length && text[zeros] === "1") zeros += 1;
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) out[out.length - 1 - i] = bytes[i];
  return out;
}

export function issueCredential(input: {
  issuer: DidKey;
  subjectDid: string;
  name?: string;
  role?: string;
  validFrom: string;
  validUntil: string;
  id: string;
}): VerifiableCredential {
  const unsigned: VerifiableCredential = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential"],
    id: input.id,
    issuer: input.issuer.did,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    credentialSubject: {
      id: input.subjectDid,
      ...(input.name ? { name: input.name } : {}),
      ...(input.role ? { role: input.role } : {}),
    },
  };
  return {
    ...unsigned,
    proof: signProof(unsigned, input.issuer.secretKeyHex, verificationMethod(input.issuer.did), "assertionMethod"),
  };
}

export function presentCredential(holder: DidKey, credential: VerifiableCredential): VerifiablePresentation {
  const unsigned: VerifiablePresentation = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiablePresentation"],
    holder: holder.did,
    verifiableCredential: [credential],
  };
  return {
    ...unsigned,
    proof: signProof(unsigned, holder.secretKeyHex, verificationMethod(holder.did), "authentication"),
  };
}

export type VerifyResult =
  | { ok: true; reason: string }
  | { ok: false; reason: string };

export function verifyPresentation(input: {
  presentation: VerifiablePresentation;
  issuer: DidKey;
  holder: DidKey;
  now: Date;
  requiredClaim: "role";
  revokedIds: string[];
}): VerifyResult {
  const { presentation, issuer, holder } = input;
  if (presentation.holder !== holder.did) return { ok: false, reason: "VP 的 holder 不是这把持有者密钥。" };
  const { proof: vpProof, ...unsignedVp } = presentation;
  if (!vpProof) return { ok: false, reason: "VP 没有 proof。" };
  if (!verifyDataProof(unsignedVp, vpProof, holder.publicKeyHex)) {
    return { ok: false, reason: "VP 的签名验证失败。出示者的私钥对不上。" };
  }
  const credential = presentation.verifiableCredential[0];
  if (!credential) return { ok: false, reason: "VP 里没有 VC。" };
  if (credential.issuer !== issuer.did) return { ok: false, reason: "VC 的 issuer 不是验证方信任的 DID。" };
  const { proof: vcProof, ...unsignedVc } = credential;
  if (!vcProof) return { ok: false, reason: "VC 没有 proof。" };
  if (!verifyDataProof(unsignedVc, vcProof, issuer.publicKeyHex)) {
    return { ok: false, reason: "VC 的签名验证失败。issuer 的私钥对不上。" };
  }
  if (input.revokedIds.includes(credential.id)) {
    return { ok: false, reason: "签名有效，但这张凭证的 id 在本课的本地状态名单里。" };
  }
  const until = Date.parse(credential.validUntil);
  const from = Date.parse(credential.validFrom);
  if (Number.isNaN(until) || Number.isNaN(from) || input.now.getTime() > until || input.now.getTime() < from) {
    return { ok: false, reason: "凭证不在有效期内。" };
  }
  if (input.requiredClaim === "role" && !credential.credentialSubject.role) {
    return { ok: false, reason: "声明不齐全。验证方要求 credentialSubject.role。" };
  }
  return { ok: true, reason: "签名、有效期和 role 声明都通过，凭证不在本地状态名单里。" };
}
