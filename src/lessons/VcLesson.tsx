import { useState } from "react";
import {
  createDidKey,
  issueCredential,
  presentCredential,
  verifyPresentation,
  type DidKey,
  type VerifiablePresentation,
} from "../crypto";
import { lessonById } from "../curriculum";
import { markCheck, revokeCredential, useStore } from "../store";
import { Fields, LessonFrame, Result, downloadText } from "../ui";

type LabKeys = { issuer: DidKey; holder: DidKey };

function stamp(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

export function VcLesson() {
  const lesson = lessonById("vc");
  const store = useStore();
  const [keys, setKeys] = useState<LabKeys | null>(null);
  const [presentation, setPresentation] = useState<VerifiablePresentation | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function ensureKeys(): LabKeys {
    if (keys) return keys;
    const next = { issuer: createDidKey(), holder: createDidKey() };
    setKeys(next);
    return next;
  }

  function run(kind: "valid" | "expired" | "missing" | "revoked") {
    const pair = ensureKeys();
    const id = `urn:uuid:${kind}-${pair.holder.publicKeyHex.slice(0, 8)}`;
    const credential = issueCredential({
      issuer: pair.issuer,
      subjectDid: pair.holder.did,
      name: "Lee",
      role: kind === "missing" ? undefined : "ops",
      validFrom: kind === "expired" ? stamp(-10) : stamp(-1),
      validUntil: kind === "expired" ? stamp(-1) : stamp(30),
      id,
    });
    if (kind === "revoked") revokeCredential(id);
    const vp = presentCredential(pair.holder, credential);
    const revokedIds = kind === "revoked" ? [...store.revokedCredentialIds, id] : store.revokedCredentialIds;
    const verdict = verifyPresentation({
      presentation: vp,
      issuer: pair.issuer,
      holder: pair.holder,
      now: new Date(),
      requiredClaim: "role",
      revokedIds,
    });
    setPresentation(vp);
    setResult({ ok: verdict.ok, text: verdict.reason });
    if (kind === "valid" && verdict.ok) markCheck("vc", "valid");
    if (kind === "expired" && verdict.reason.includes("有效期")) markCheck("vc", "expired");
    if (kind === "missing" && verdict.reason.includes("role")) markCheck("vc", "missing");
    if (kind === "revoked" && verdict.reason.includes("状态名单")) markCheck("vc", "revoked");
  }

  const credential = presentation?.verifiableCredential[0];

  return (
    <LessonFrame
      lesson={lesson}
      inspector={
        <Fields
          rows={
            credential
              ? [
                  { name: "issuer", value: String(credential.issuer), note: "DID，不是 CA" },
                  { name: "holder", value: presentation?.holder ?? "" },
                  { name: "credentialSubject", value: JSON.stringify(credential.credentialSubject) },
                  { name: "validFrom", value: credential.validFrom },
                  { name: "validUntil", value: credential.validUntil },
                  { name: "VC proof", value: credential.proof?.proofValue ?? "" },
                  { name: "VP proof", value: presentation?.proof?.proofValue ?? "" },
                  { name: "本地状态名单", value: store.revokedCredentialIds.join(", ") || "(空)" },
                ]
              : keys
                ? [
                    { name: "issuer", value: keys.issuer.did },
                    { name: "holder", value: keys.holder.did },
                  ]
                : []
          }
        />
      }
    >
      <p>验证方信任的是这把 issuer DID。VP 是持有者的出示，不是另一张证书。</p>
      <div className="row">
        <button type="button" onClick={() => run("valid")}>
          出示有效 VP
        </button>
        <button type="button" className="ghost" onClick={() => run("expired")}>
          出示过期凭证
        </button>
        <button type="button" className="ghost" onClick={() => run("missing")}>
          出示缺 role 的凭证
        </button>
        <button type="button" className="ghost" onClick={() => run("revoked")}>
          吊销后再出示
        </button>
      </div>
      {result ? <Result ok={result.ok} text={result.text} /> : null}
      {presentation ? (
        <button
          type="button"
          className="ghost"
          onClick={() => downloadText("presentation.json", JSON.stringify(presentation, null, 2), "application/json")}
        >
          下载 VP
        </button>
      ) : null}
    </LessonFrame>
  );
}
