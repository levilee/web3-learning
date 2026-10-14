import { useState } from "react";
import { createAccount, flipLastCharacter, sha256Hex, signMessage, verifyMessage } from "../crypto";
import { lessonById } from "../curriculum";
import { markCheck, useStore } from "../store";
import { Choice, Fields, LessonFrame, Result, downloadText } from "../ui";

export function HashLesson() {
  const lesson = lessonById("hash");
  const store = useStore();
  const [message, setMessage] = useState("运维交接：证书在 4 月 2 日到期");
  const [changed, setChanged] = useState<string | null>(null);
  const [signed, setSigned] = useState<{ message: string; signature: string; publicKey: string } | null>(null);
  const [tamper, setTamper] = useState<{ message: string; ok: boolean } | null>(null);
  const [choiceNote, setChoiceNote] = useState("");
  const hash = sha256Hex(message);
  const changedHash = changed ? sha256Hex(changed) : "";

  return (
    <LessonFrame
      lesson={lesson}
      inspector={
        <Fields
          rows={[
            { name: "message", value: message },
            { name: "SHA-256", value: hash },
            ...(changed ? [{ name: "changed message", value: changed }, { name: "changed SHA-256", value: changedHash }] : []),
            ...(signed
              ? [
                  { name: "public key", value: signed.publicKey, note: "未压缩 secp256k1 公钥" },
                  { name: "signature", value: signed.signature, note: "对原始文字的 SHA-256 签名" },
                ]
              : []),
          ]}
        />
      }
    >
      <label>
        文字
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} />
      </label>
      <p className="mono">{hash}</p>
      <div className="row">
        <button
          type="button"
          onClick={() => {
            const next = flipLastCharacter(message);
            setChanged(next);
            if (sha256Hex(next) !== hash) markCheck("hash", "hashChanged");
          }}
        >
          改一个字节
        </button>
        <button
          type="button"
          onClick={() => {
            const account = store.account ?? createAccount();
            const signature = signMessage(message, account.secretKeyHex);
            const ok = verifyMessage(message, signature, account.publicKeyHex);
            setSigned({ message, signature, publicKey: account.publicKeyHex });
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
            const ok = verifyMessage(tampered, signed.signature, signed.publicKey);
            setTamper({ message: tampered, ok });
            if (!ok) markCheck("hash", "tamperedFail");
          }}
        >
          篡改文字后再验证
        </button>
      </div>
      {changed && changedHash !== hash ? <Result ok text="哈希变了。一个字节就够。" /> : null}
      {signed ? <Result ok text="原始文字的签名验证通过。" /> : null}
      {tamper ? <Result ok={tamper.ok} text={tamper.ok ? "篡改后仍然通过。这不应该发生。" : `「${tamper.message}」验证失败。`} /> : null}
      {signed ? (
        <button type="button" className="ghost" onClick={() => downloadText("signature.json", JSON.stringify(signed, null, 2), "application/json")}>
          下载签名
        </button>
      ) : null}
      {tamper && !tamper.ok ? (
        <Choice
          name="验证失败是因为？"
          options={[
            { id: "message", label: "文字被改过，摘要对不上原来的签名", correct: true },
            { id: "key", label: "公钥丢了" },
            { id: "algo", label: "哈希算法自己换了" },
          ]}
          onPick={(_id, correct) => {
            if (correct) {
              markCheck("hash", "reason");
              setChoiceNote("对。失败原因是文字被改过。");
            } else {
              setChoiceNote("再看字段检查器里的两段文字和同一份签名。");
            }
          }}
        />
      ) : null}
      {choiceNote ? <p>{choiceNote}</p> : null}
    </LessonFrame>
  );
}
