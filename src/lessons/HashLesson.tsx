import { useState } from "react";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { createAccount, explainTamper, flipLastCharacter, sha256Of, signMessage, verifyMessage } from "../crypto";
import { lessonById } from "../curriculum";
import { markCheck } from "../store";
import { AlgorithmAtlas, ByteFlip, SignPipeline, Sources } from "../diagrams";
import { Fields, LessonFrame, Result, downloadText } from "../ui";

type ByteDemo = {
  beforeHex: string;
  afterHex: string;
  beforeHash: string;
  afterHash: string;
};

export function HashLesson() {
  const lesson = lessonById("hash");
  const [message, setMessage] = useState("运维交接：证书在 4 月 2 日到期");
  const [bytes, setBytes] = useState<ByteDemo | null>(null);
  const [signed, setSigned] = useState<{ message: string; signature: string; publicKey: string } | null>(null);
  const [tamper, setTamper] = useState<{ message: string; reason: string } | null>(null);
  const [signer] = useState(() => createAccount());

  return (
    <LessonFrame
      lesson={lesson}
      inspector={
        <Fields
          rows={[
            { name: "message", value: message },
            ...(bytes
              ? [
                  { name: "original bytes", value: bytes.beforeHex },
                  { name: "flipped byte", value: bytes.afterHex, note: "只改了最后一个字节" },
                  { name: "SHA-256", value: bytes.beforeHash },
                  { name: "SHA-256 after", value: bytes.afterHash },
                ]
              : []),
            ...(signed
              ? [
                  { name: "public key", value: signed.publicKey, note: "未压缩 secp256k1 公钥" },
                  { name: "signature", value: signed.signature, note: "对原始文字的 SHA-256 签名" },
                ]
              : []),
            ...(tamper ? [{ name: "失败原因", value: tamper.reason }] : []),
          ]}
        />
      }
    >
      <AlgorithmAtlas />
      <Sources which="crypto" />
      <label>
        文字
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} />
      </label>
      <div className="row">
        <button
          type="button"
          disabled={message.length === 0}
          onClick={() => {
            const original = utf8ToBytes(message);
            const flipped = new Uint8Array(original);
            flipped[flipped.length - 1] ^= 0x01;
            const beforeHash = sha256Of(original);
            const afterHash = sha256Of(flipped);
            setBytes({
              beforeHex: bytesToHex(original),
              afterHex: bytesToHex(flipped),
              beforeHash,
              afterHash,
            });
            if (beforeHash !== afterHash) markCheck("hash", "hashChanged");
          }}
        >
          改一个字节
        </button>
        <button
          type="button"
          onClick={() => {
            const signature = signMessage(message, signer.secretKeyHex);
            const ok = verifyMessage(message, signature, signer.publicKeyHex);
            setSigned({ message, signature, publicKey: signer.publicKeyHex });
            setTamper(null);
            if (ok) markCheck("hash", "signedOk");
          }}
        >
          签名并验证
        </button>
        <button
          type="button"
          disabled={!signed}
          onClick={() => {
            if (!signed) return;
            const tampered = flipLastCharacter(signed.message);
            const verdict = explainTamper(signed.message, tampered, signed.signature, signed.publicKey);
            setTamper({ message: tampered, reason: verdict.reason });
            if (!verdict.ok) markCheck("hash", "tamperedFail");
            if (verdict.reason === "消息已改变") markCheck("hash", "reason");
          }}
        >
          篡改文字后再验证
        </button>
      </div>
      {signed ? (
        <SignPipeline
          message={signed.message}
          signature={signed.signature}
          publicKey={signed.publicKey}
          compareMessage={tamper?.message}
        />
      ) : null}
      {bytes && bytes.beforeHash !== bytes.afterHash ? <ByteFlip before={bytes.beforeHex} after={bytes.afterHex} /> : null}
      {tamper ? <Result ok={false} testId="verify-reason" text={`验证失败：${tamper.reason}`} /> : null}
      {signed ? (
        <button
          type="button"
          className="ghost"
          onClick={() => downloadText("signature.json", JSON.stringify({ ...signed, failure: tamper?.reason ?? null }, null, 2), "application/json")}
        >
          下载签名
        </button>
      ) : null}
    </LessonFrame>
  );
}
