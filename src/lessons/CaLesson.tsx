import { useState } from "react";
import { issueLabCerts, readCert, verifyLeaf, type IssuedMaterial } from "../cert";
import { lessonById } from "../curriculum";
import { markCheck } from "../store";
import { Fields, LessonFrame, Result, downloadText } from "../ui";

type Verdict = { ok: boolean; reason: string };

type Outcomes = {
  ok?: Verdict;
  wrong?: Verdict;
  revoked?: Verdict;
};

export function CaLesson() {
  const lesson = lessonById("ca");
  const [material, setMaterial] = useState<IssuedMaterial | null>(null);
  const [revoked, setRevoked] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<Outcomes>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const leaf = material ? readCert(material.leafPem) : null;
  const ca = material ? readCert(material.caPem) : null;

  async function issue() {
    setBusy(true);
    setError("");
    try {
      const next = await issueLabCerts();
      setMaterial(next);
      setRevoked([]);
      setOutcomes({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "签发失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <LessonFrame
      lesson={lesson}
      inspector={
        <Fields
          rows={
            leaf && ca
              ? [
                  { name: "issuer", value: leaf.issuer },
                  { name: "subject", value: leaf.subject },
                  { name: "validity", value: `${leaf.notBefore} → ${leaf.notAfter}` },
                  { name: "serialNumber", value: leaf.serialNumber },
                  { name: "keyUsage", value: leaf.keyUsage },
                  { name: "basicConstraints.ca", value: String(leaf.ca), note: "叶子证书不是 CA" },
                  { name: "CA keyUsage", value: ca.keyUsage },
                  { name: "教学吊销名单", value: revoked.length ? revoked.join(", ") : "(空)", note: "不是 OCSP" },
                ]
              : []
          }
        />
      }
    >
      <p>先签发一对真的 X.509 证书，再用三把结果看验证。</p>
      <div className="row">
        <button type="button" onClick={() => void issue()} disabled={busy}>
          {busy ? "正在签发" : "签发 CA 和叶子证书"}
        </button>
        {material ? (
          <>
            <button type="button" className="ghost" onClick={() => downloadText("learning-ca.pem", material.caPem, "application/x-pem-file")}>
              下载 CA PEM
            </button>
            <button type="button" className="ghost" onClick={() => downloadText("learner.pem", material.leafPem, "application/x-pem-file")}>
              下载叶子 PEM
            </button>
          </>
        ) : null}
      </div>
      {error ? <Result ok={false} text={error} /> : null}
      {material ? (
        <div className="row">
            <button
            type="button"
            onClick={() => {
              void verifyLeaf(material.leafPem, material.caPem, revoked).then((result) => {
                setOutcomes((current) => ({ ...current, ok: result }));
                if (result.ok) markCheck("ca", "verifyOk");
              });
            }}
          >
            用正确的 CA 验证
          </button>
          <button
            type="button"
            onClick={() => {
              void verifyLeaf(material.leafPem, material.otherCaPem, []).then((result) => {
                setOutcomes((current) => ({ ...current, wrong: result }));
                if (!result.ok && result.reason.includes("签名")) markCheck("ca", "wrongCa");
              });
            }}
          >
            用另一把 CA 验证
          </button>
          <button
            type="button"
            onClick={() => {
              const next = Array.from(new Set([...revoked, material.leafSerial]));
              setRevoked(next);
              void verifyLeaf(material.leafPem, material.caPem, next).then((result) => {
                setOutcomes((current) => ({ ...current, revoked: result }));
                if (!result.ok && result.reason.includes("吊销")) markCheck("ca", "revoked");
              });
            }}
          >
            把序列号放进教学吊销名单
          </button>
          {revoked.length > 0 ? (
            <button type="button" className="ghost" onClick={() => setRevoked([])}>
              从教学吊销名单移出
            </button>
          ) : null}
        </div>
      ) : null}
      {outcomes.ok ? <Result ok={outcomes.ok.ok} text={outcomes.ok.reason} /> : null}
      {outcomes.wrong ? <Result ok={outcomes.wrong.ok} text={outcomes.wrong.reason} /> : null}
      {outcomes.revoked ? <Result ok={outcomes.revoked.ok} testId="revoke-result" text={outcomes.revoked.reason} /> : null}
      <p className="bridge">证书的 issuer 是目录里的 CA。持有者不能只把其中一项声明单独拿出来。第 7 课从这里接上。</p>
    </LessonFrame>
  );
}
