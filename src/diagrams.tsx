import { useEffect, useState } from "react";
import { describeSignature } from "./crypto";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { CheckStep } from "./cert";

export function Trace({ ok, steps }: { ok: boolean; steps: CheckStep[] }) {
  return (
    <ol className={ok ? "trace ok" : "trace bad"}>
      {steps.map((step) => (
        <li key={step.title} className={step.ok === false ? "fail" : step.ok ? "pass" : ""}>
          <strong>{step.title}</strong>
          <span>{step.body}</span>
        </li>
      ))}
    </ol>
  );
}

export function AlgorithmAtlas() {
  return (
    <section className="atlas">
      <h2>这门课里设定的算法</h2>
      <p>
        哈希把任意内容收成摘要，用来发现内容被改过。数字签名不是“私钥加密、公钥解密”：ECDSA 和 Ed25519 没有解密这一步。验签用的是公钥和同一种算法。
      </p>
      <div className="atlas-grid">
        <article>
          <HashMark />
          <h3>SHA-256</h3>
          <p className="tag">哈希 · 没有密钥</p>
          <p>任意长度收成 32 字节。本课先对原文做 SHA-256，再签名。第 4 课的 Merkle 也用它。</p>
        </article>
        <article>
          <HashMark />
          <h3>Keccak-256</h3>
          <p className="tag">哈希 · 没有密钥</p>
          <p>也是 32 字节，填充规则和 SHA-256 不同。同一段字节会得到另一个摘要。第 3 课用它从公钥算出地址。</p>
        </article>
        <article className="here">
          <CurveMark />
          <h3>ECDSA · secp256k1</h3>
          <p className="tag">签名 · 本课使用</p>
          <p>签名是 (r, s)，各 32 字节。私钥是曲线上的标量，公钥是点。第 5 课的交易用同一套。</p>
        </article>
        <article>
          <CurveMark />
          <h3>ECDSA · P-256</h3>
          <p className="tag">签名 · 第 2 课证书</p>
          <p>还是 ECDSA，换成 NIST 的 P-256。证书里的算法标识是 ecdsa-with-SHA256。这把公钥验不了 secp256k1 的签名。</p>
        </article>
        <article>
          <EdwardsMark />
          <h3>Ed25519</h3>
          <p className="tag">签名 · 第 7 课 DID</p>
          <p>EdDSA，曲线是 Edwards。内部用 SHA-512，签名 64 字节。它和 ECDSA 都是签名算法，检查式不同，也不能拿来解密。</p>
        </article>
      </div>
    </section>
  );
}

export function SignPipeline({
  message,
  signature,
  publicKey,
  compareMessage,
}: {
  message: string;
  signature: string;
  publicKey: string;
  compareMessage?: string;
}) {
  const signed = describeSignature(message, signature, publicKey);
  const compared = compareMessage ? describeSignature(compareMessage, signature, publicKey) : null;
  const mismatch = compared ? compared.digest !== signed.digest : false;
  const { frame, replay } = useFrames(`${message}|${signature}|${compareMessage ?? ""}`, 4);
  const captions = [
    "原文还是 UTF-8 字节。哈希和签名都还没开始。",
    "SHA-256 没有密钥，把这些字节收成 32 字节摘要 h。",
    "私钥在 secp256k1 上对这个 h 做 ECDSA，写出 r 和 s。各 32 字节。",
    mismatch
      ? "验证重新计算 h。原文变了，h 变了，r 和 s 仍是签名时的值，所以对不上。"
      : "验证用公钥重算。h 和签名时相同，R 的 x 等于 r，通过。这一步不是解密。",
  ];
  return (
    <section className="pipeline">
      <div className="pipeline-head">
        <h2>这次签名是怎么来的</h2>
        <button type="button" className="ghost" onClick={replay}>
          再播放
        </button>
      </div>
      <svg className="flow-svg" viewBox="0 0 760 132" role="img" aria-label="原文经过 SHA-256 得到摘要，再用 secp256k1 私钥做 ECDSA，得到 r 和 s">
        <FlowBox x={8} y={28} title="原文" sub="UTF-8" stage={0} frame={frame} />
        <FlowArrow x={158} label="SHA-256" stage={1} frame={frame} />
        <FlowBox x={214} y={28} title="摘要" sub="32 字节" stage={1} frame={frame} hot={mismatch && frame >= 3} />
        <FlowArrow x={364} label="私钥" stage={2} frame={frame} />
        <FlowBox x={420} y={28} title="ECDSA" sub="secp256k1" stage={2} frame={frame} />
        <FlowArrow x={570} label="公钥" stage={3} frame={frame} />
        <FlowBox
          x={626}
          y={28}
          title={frame < 3 ? "验证" : compared ? (compared.ok ? "通过" : "失败") : signed.ok ? "通过" : "失败"}
          sub="核对 r"
          stage={3}
          frame={frame}
          hot={mismatch && frame >= 3}
        />
      </svg>
      <p className="caption" aria-live="polite">
        {captions[frame]}
      </p>
      <div className="flow-values">
        <p className={frame >= 0 ? "shown" : ""}>
          <b>{signed.messageBytes} 字节</b>
          <span>还没进签名算法</span>
        </p>
        <p className={frame >= 1 ? "shown" : "hidden-step"}>
          <b>签进去的 h</b>
          <code>{signed.digest}</code>
          {compared && frame >= 3 ? (
            <>
              <b>现在重算的 h</b>
              <code>{compared.digest}</code>
            </>
          ) : null}
        </p>
        <p className={frame >= 2 ? "shown" : "hidden-step"}>
          <b>r</b>
          <code>{signed.r}</code>
          <b>s</b>
          <code>{signed.s}</code>
        </p>
        <p className={frame >= 3 ? "shown" : "hidden-step"}>
          <b>{compared ? (compared.ok ? "对上了" : "没对上") : signed.ok ? "对上了" : "没对上"}</b>
          <span>h、r、s 和公钥一起算</span>
        </p>
      </div>
      <p className="equation">
        验证重做一遍：h = SHA-256(拿来验证的原文)；R = (h · s⁻¹)G + (r · s⁻¹)P；看 R 的 x 是不是 r。P 是上面的公钥。这一步是验签，不是解密。r 和 s 在签名时已经定了，原文后来被改，它们也不会跟着变。
        {mismatch ? " 两段 h 不同，所以后一次的 R 对不上原来的 r。" : " 这次拿来验证的原文和签名时相同，h 相同，所以通过对。"}
      </p>
    </section>
  );
}

export function ByteFlip({ before, after }: { before: string; after: string }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    setFlipped(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setFlipped(true);
      return;
    }
    const id = window.setTimeout(() => setFlipped(true), 450);
    return () => window.clearTimeout(id);
  }, [before, after]);
  return (
    <p className="byteflip">
      最后一个字节
      <code className={flipped ? "from" : "from stay"}>{before.slice(-2)}</code>
      <span aria-hidden="true">→</span>
      <code className={flipped ? "to" : "to wait"}>{after.slice(-2)}</code>
      <span>SHA-256 的 32 字节摘要跟着整个换掉。</span>
    </p>
  );
}

function useFrames(token: string, count: number) {
  const [frame, setFrame] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setFrame(count - 1);
      return;
    }
    setFrame(0);
    let current = 0;
    const id = window.setInterval(() => {
      current += 1;
      if (current >= count) {
        setFrame(count - 1);
        window.clearInterval(id);
        return;
      }
      setFrame(current);
    }, 1100);
    return () => window.clearInterval(id);
  }, [token, run, count]);
  return { frame, replay: () => setRun((value) => value + 1) };
}

function FlowBox({
  x,
  y,
  title,
  sub,
  hot = false,
  stage = 0,
  frame = 0,
}: {
  x: number;
  y: number;
  title: string;
  sub: string;
  hot?: boolean;
  stage?: number;
  frame?: number;
}) {
  const reached = frame >= stage;
  const current = frame === stage;
  const fill = !reached ? "#f3efe8" : hot ? "#f8e7e4" : current ? "#e4f3ee" : "#fbf7f1";
  const stroke = !reached ? "#d5cbbd" : hot ? "#8d2c2c" : current ? "#0d6a56" : "#1b1814";
  return (
    <g opacity={reached ? 1 : 0.4}>
      <rect x={x} y={y} width="120" height="72" rx="14" fill={fill} stroke={stroke} strokeWidth={current ? 3 : 1.5} />
      <text x={x + 60} y={y + 32} textAnchor="middle" fontSize="16" fill="#1b1814">
        {title}
      </text>
      <text x={x + 60} y={y + 54} textAnchor="middle" fontSize="12" fill="#645d53">
        {sub}
      </text>
    </g>
  );
}

function FlowArrow({ x, label, stage = 0, frame = 0 }: { x: number; label: string; stage?: number; frame?: number }) {
  const moving = frame === stage;
  return (
    <g opacity={frame >= stage ? 1 : 0.25}>
      <line x1={x} y1={64} x2={x + 44} y2={64} stroke="#1b1814" className={moving ? "march" : undefined} />
      <polygon points={`${x + 44},59 ${x + 54},64 ${x + 44},69`} fill="#1b1814" />
      <text x={x + 22} y={22} textAnchor="middle" fontSize="11" fill="#645d53">
        {label}
      </text>
    </g>
  );
}

function HashMark() {
  return (
    <svg viewBox="0 0 72 40" className="mark" aria-hidden="true">
      <rect x="2" y="8" width="28" height="24" rx="4" fill="none" stroke="currentColor" />
      <path d="M34 20 H48" stroke="currentColor" />
      <polygon points="48,16 56,20 48,24" fill="currentColor" />
      <rect x="58" y="12" width="12" height="16" rx="2" fill="currentColor" />
    </svg>
  );
}

function CurveMark() {
  return (
    <svg viewBox="0 0 72 40" className="mark" aria-hidden="true">
      <path d="M6 32 C18 32 20 8 36 8 C52 8 54 32 66 32" fill="none" stroke="currentColor" />
      <circle cx="36" cy="8" r="3.5" fill="currentColor" />
    </svg>
  );
}

function EdwardsMark() {
  return (
    <svg viewBox="0 0 72 40" className="mark" aria-hidden="true">
      <path d="M8 20 C18 6 28 6 36 20 C44 34 54 34 64 20" fill="none" stroke="currentColor" />
      <circle cx="36" cy="20" r="3.5" fill="currentColor" />
    </svg>
  );
}

export function CompileDiagram({ count }: { count: number }) {
  const selector = bytesToHex(keccak_256(utf8ToBytes("setCount(uint256)")).subarray(0, 4));
  const argument = count.toString(16).padStart(64, "0");
  const { frame, replay } = useFrames(`compile-${count}`, 4);
  const captions = [
    "先有 Solidity 源码。这时还没有能放进交易的 data。",
    "solc --abi 给出函数接口，solc --bin 给出 EVM 字节码。",
    "部署时 data 放字节码。调用时 data 放选择子加 ABI 参数。",
    "执行发生在 EVM 里，结果写进存储。本课按钮不跑这两步。",
  ];
  return (
    <section className="atlas">
      <div className="pipeline-head">
        <h2>合约调用在链上长什么样</h2>
        <button type="button" className="ghost" onClick={replay}>
          再播放
        </button>
      </div>
      <p>Solidity 源码要先编译。solc --abi 得到接口，solc --bin 得到 EVM 字节码。部署时字节码放进交易的 data。调用时按 ABI 把函数和参数编码进 data。</p>
      <svg className="flow-svg" viewBox="0 0 760 148" role="img" aria-label="Solidity 经 solc 分成 ABI 和字节码，调用数据放进交易 data">
        <FlowBox x={16} y={36} title="Solidity" sub="源码" stage={0} frame={frame} />
        <FlowArrow x={146} label="solc" stage={1} frame={frame} />
        <FlowBox x={210} y={8} title="ABI" sub="--abi" stage={1} frame={frame} />
        <FlowBox x={210} y={84} title="字节码" sub="--bin" stage={1} frame={frame} />
        <FlowArrow x={340} label="编码" stage={2} frame={frame} />
        <FlowBox x={404} y={36} title="data" sub="交易字段" stage={2} frame={frame} />
        <FlowArrow x={534} label="执行" stage={3} frame={frame} />
        <FlowBox x={598} y={36} title="存储" sub="EVM" stage={3} frame={frame} />
      </svg>
      <p className="caption" aria-live="polite">
        {captions[frame]}
      </p>
      <div className="flow-values compile-values">
        <p className={frame >= 1 ? "shown" : "hidden-step"}>
          <b>函数选择子</b>
          <code>{selector}</code>
          <span>keccak256("setCount(uint256)") 的前 4 字节</span>
        </p>
        <p className={frame >= 2 ? "shown" : "hidden-step"}>
          <b>ABI 编码的参数</b>
          <code>{argument}</code>
          <span>uint256 的 count，32 字节</span>
        </p>
        <p className={frame >= 2 ? "shown" : "hidden-step"}>
          <b>若按 ABI，data 是</b>
          <code>{selector}{argument}</code>
        </p>
        <p className={frame >= 3 ? "shown" : "hidden-step"}>
          <b>本课模拟账本的 data</b>
          <code>{`setCount:${count}`}</code>
          <span>可读文本。没有 solc，也没有真 EVM</span>
        </p>
      </div>
    </section>
  );
}

export function Sources({ which }: { which: "crypto" | "contract" }) {
  return (
    <p className="sources">
      {which === "crypto" ? (
        <>
          算法和证书的讲法参照
          <a href="https://yeasy.gitbook.io/blockchain_guide/05_crypto/hash"> Hash 与摘要</a>、
          <a href="https://yeasy.gitbook.io/blockchain_guide/05_crypto/signature">数字签名</a>、
          <a href="https://yeasy.gitbook.io/blockchain_guide/05_crypto/cert">数字证书</a>。
        </>
      ) : (
        <>
          编译过程参照
          <a href="https://goethereumbook.org/zh/smart-contract-compile/">《Ethereum Development with Go》智能合约的编译与 ABI</a>
          ，合约在以太坊里的位置参照
          <a href="https://yeasy.gitbook.io/blockchain_guide/07_ethereum/smart_contract">《区块链技术指南》使用智能合约</a>。
        </>
      )}
    </p>
  );
}
