import "reflect-metadata";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  BasicConstraintsExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
  X509Certificate,
  X509CertificateGenerator,
} from "@peculiar/x509";

const SIGNING = { name: "ECDSA", hash: "SHA-256" } as const;
const KEY_ALG = { name: "ECDSA", namedCurve: "P-256" } as const;

export type CertFields = {
  serialNumber: string;
  issuer: string;
  subject: string;
  notBefore: string;
  notAfter: string;
  ca: boolean;
  keyUsage: string;
};

export type IssuedMaterial = {
  caPem: string;
  leafPem: string;
  otherCaPem: string;
  leafSerial: string;
};

function usageNames(flags: number): string {
  const names: string[] = [];
  if (flags & KeyUsageFlags.digitalSignature) names.push("digitalSignature");
  if (flags & KeyUsageFlags.keyCertSign) names.push("keyCertSign");
  if (flags & KeyUsageFlags.cRLSign) names.push("cRLSign");
  if (flags & KeyUsageFlags.keyEncipherment) names.push("keyEncipherment");
  return names.join(", ") || "(none)";
}

export function readCert(pem: string): CertFields {
  const cert = new X509Certificate(pem);
  const basic = cert.getExtension(BasicConstraintsExtension);
  const usage = cert.getExtension(KeyUsagesExtension);
  return {
    serialNumber: cert.serialNumber.toLowerCase(),
    issuer: cert.issuer,
    subject: cert.subject,
    notBefore: cert.notBefore.toISOString(),
    notAfter: cert.notAfter.toISOString(),
    ca: basic?.ca ?? false,
    keyUsage: usageNames(usage?.usages ?? 0),
  };
}

async function generatePair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(KEY_ALG, true, ["sign", "verify"]);
}

function randomSerial(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function issueLabCerts(): Promise<IssuedMaterial> {
  const notBefore = new Date();
  const notAfter = new Date(notBefore.getTime() + 365 * 24 * 60 * 60 * 1000);
  const caKeys = await generatePair();
  const leafKeys = await generatePair();
  const otherKeys = await generatePair();
  const ca = await X509CertificateGenerator.createSelfSigned({
    name: "CN=Learning CA, O=Web3 Learning",
    keys: caKeys,
    serialNumber: "01",
    notBefore,
    notAfter,
    signingAlgorithm: SIGNING,
    extensions: [
      new BasicConstraintsExtension(true, 0, true),
      new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
    ],
  });
  const leafSerial = randomSerial();
  const leaf = await X509CertificateGenerator.create({
    serialNumber: leafSerial,
    subject: "CN=Learner, O=Web3 Learning",
    issuer: ca.subject,
    publicKey: leafKeys.publicKey,
    signingKey: caKeys.privateKey,
    signingAlgorithm: SIGNING,
    notBefore,
    notAfter,
    extensions: [
      new BasicConstraintsExtension(false, undefined, true),
      new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
    ],
  });
  const other = await X509CertificateGenerator.createSelfSigned({
    name: "CN=Other CA, O=Web3 Learning",
    keys: otherKeys,
    serialNumber: "02",
    notBefore,
    notAfter,
    signingAlgorithm: SIGNING,
    extensions: [
      new BasicConstraintsExtension(true, 0, true),
      new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
    ],
  });
  return {
    caPem: ca.toString("pem"),
    leafPem: leaf.toString("pem"),
    otherCaPem: other.toString("pem"),
    leafSerial: leafSerial.toLowerCase(),
  };
}

export type CheckStep = { title: string; body: string; ok: boolean | null };

function fingerprint(cert: X509Certificate): string {
  return bytesToHex(sha256(new Uint8Array(cert.publicKey.rawData)));
}

export async function verifyLeaf(
  leafPem: string,
  caPem: string,
  revokedSerials: string[],
  issuingCaPem = caPem,
): Promise<{ ok: boolean; reason: string; steps: CheckStep[] }> {
  const leaf = new X509Certificate(leafPem);
  const ca = new X509Certificate(caPem);
  const issuer = new X509Certificate(issuingCaPem);
  const usedKey = fingerprint(ca);
  const issuerKey = fingerprint(issuer);
  const signatureBytes = new Uint8Array(leaf.signature);
  const serial = leaf.serialNumber.toLowerCase();
  const listed = revokedSerials.map((item) => item.toLowerCase());
  const signatureOk = await leaf.verify({ publicKey: ca.publicKey, signatureOnly: true });
  const sameKey = usedKey === issuerKey;
  const steps: CheckStep[] = [
    {
      title: "证书里已经写好的签名",
      ok: null,
      body: `叶子证书的签名算法是 ECDSA + SHA-256，曲线是 P-256。签名盖在待签名内容上：issuer、subject、validity、serial、扩展。签名共 ${signatureBytes.length} 字节，开头是 ${bytesToHex(signatureBytes.slice(0, 12))}。`,
    },
    {
      title: "这次代入哪一把公钥",
      ok: sameKey,
      body: sameKey
        ? `验证方代入 ${ca.subject}。公钥指纹 SHA-256(SPKI) = ${usedKey}。证书 issuer 栏写的是「${leaf.issuer}」，真正参加运算的是这把公钥，不是这行字。`
        : `验证方代入 ${ca.subject}，指纹 ${usedKey}。签发叶子时用的是 ${issuer.subject}，指纹 ${issuerKey}。两把公钥不一样。issuer 栏仍写着「${leaf.issuer}」，这行字不会换成另一把钥匙。`,
    },
    {
      title: "ECDSA 核对",
      ok: signatureOk,
      body: signatureOk
        ? "用代入的公钥验证通过：待签名内容的 SHA-256 和签名里的 (r, s) 能在 P-256 上对上。"
        : "用代入的公钥验证失败。P-256 上用这把公钥和证书里的 (r, s) 算出来的点，x 坐标不是 r。失败来自公钥不同，不是因为序列号或名字写错。",
    },
  ];
  if (!signatureOk) {
    steps.push({
      title: "吊销名单还没轮到",
      ok: null,
      body: "签名没有通过，不再查教学吊销名单。名单比对是下一步，独立于 ECDSA。",
    });
    return { ok: false, reason: "签名验证失败。这张证书不是这把 CA 公钥签发的。", steps };
  }
  const revoked = listed.includes(serial);
  steps.push({
    title: "教学吊销名单",
    ok: !revoked,
    body: revoked
      ? `签名已经通过。序列号 ${serial} 出现在名单 [${listed.join(", ")}] 里，所以拒绝。这里比的是序列号，没有再算一次签名，也没有连接 OCSP。`
      : `签名已经通过。序列号 ${serial} 不在名单 ${listed.length ? `[${listed.join(", ")}]` : "(空)"} 里。`,
  });
  if (revoked) {
    return { ok: false, reason: "签名链有效，但序列号在教学吊销名单里。页面没有连接 OCSP。", steps };
  }
  return { ok: true, reason: "签名验证通过，序列号不在教学吊销名单里。", steps };
}
