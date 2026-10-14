import "reflect-metadata";
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

export async function verifyLeaf(leafPem: string, caPem: string, revokedSerials: string[]): Promise<{ ok: boolean; reason: string }> {
  const leaf = new X509Certificate(leafPem);
  const ca = new X509Certificate(caPem);
  const signatureOk = await leaf.verify({ publicKey: ca.publicKey, signatureOnly: true });
  if (!signatureOk) {
    return { ok: false, reason: "签名验证失败。这张证书不是这把 CA 公钥签发的。" };
  }
  const serial = leaf.serialNumber.toLowerCase();
  if (revokedSerials.map((item) => item.toLowerCase()).includes(serial)) {
    return { ok: false, reason: "签名链有效，但序列号在教学吊销名单里。页面没有连接 OCSP。" };
  }
  return { ok: true, reason: "签名验证通过，序列号不在教学吊销名单里。" };
}
