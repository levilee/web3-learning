import { useEffect, useState } from "react";
import { createAccount } from "../crypto";
import { lessonById } from "../curriculum";
import { applyBlock, buildTx, namedAccounts, type Tx } from "../ledger";
import { getState, markCheck, saveAccount, saveLedger, useStore } from "../store";
import { Fields, LessonFrame, Result, downloadText } from "../ui";

export function TxLesson() {
  const lesson = lessonById("tx");
  const store = useStore();
  const { bob } = namedAccounts();
  const [to, setTo] = useState(bob.address);
  const [value, setValue] = useState(1);
  const [data, setData] = useState("");
  const [nonceInput, setNonceInput] = useState(0);
  const [last, setLast] = useState<{ ok: boolean; text: string; tx?: Tx } | null>(null);
  const account = store.account;
  const balance = account ? (store.ledger.accounts[account.address]?.balance ?? 0) : 0;
  const nonce = account ? (store.ledger.accounts[account.address]?.nonce ?? 0) : 0;

  useEffect(() => {
    setNonceInput(nonce);
  }, [nonce]);

  function submit(kind: "ok" | "nonce" | "balance") {
    const signer = account ?? createAccount();
    if (!account) saveAccount(signer);
    const ledger = getState().ledger;
    const current = ledger.accounts[signer.address] ?? { balance: 0, nonce: 0 };
    const tx = buildTx(ledger, signer, {
      to,
      value: kind === "balance" ? current.balance + 10 : Math.max(0, value),
      data,
      nonce: kind === "nonce" ? current.nonce + 3 : kind === "ok" ? nonceInput : current.nonce,
    });
    const applied = applyBlock(ledger, [tx]);
    if (applied.ok) {
      saveLedger(applied.ledger);
      setLast({ ok: true, text: "交易入账。nonce 已加一，余额已扣减。", tx });
      markCheck("tx", "accepted");
      return;
    }
    setLast({ ok: false, text: applied.reason, tx });
    if (applied.reason.includes("nonce 不正确")) markCheck("tx", "badNonce");
    if (applied.reason.includes("余额不足")) markCheck("tx", "lowBalance");
  }

  return (
    <LessonFrame
      lesson={lesson}
      inspector={
        <Fields
          rows={
            last?.tx
              ? [
                  { name: "from", value: last.tx.from },
                  { name: "to", value: last.tx.to },
                  { name: "value", value: String(last.tx.value) },
                  { name: "nonce", value: String(last.tx.nonce) },
                  { name: "data", value: last.tx.data || "(空)" },
                  { name: "signature", value: last.tx.signature },
                ]
              : account
                ? [
                    { name: "from", value: account.address },
                    { name: "balance", value: String(balance) },
                    { name: "next nonce", value: String(nonce) },
                  ]
                : []
          }
        />
      }
    >
      <p>第 3 课的密钥就是这个账户。faucet 已经给它转过 100。收款人是账本里的 bob。</p>
      {account ? (
        <p className="mono">
          {account.address}
          <br />
          余额 {balance} · 下一笔 nonce {nonce}
        </p>
      ) : (
        <p>还没有账户。提交时会生成第 3 课同一把密钥。</p>
      )}
      <label>
        from
        <input value={account?.address ?? "提交时使用第 3 课的密钥"} readOnly />
      </label>
      <label>
        to
        <input value={to} onChange={(event) => setTo(event.target.value.trim())} spellCheck={false} />
      </label>
      <label>
        value
        <input type="number" min={0} value={value} onChange={(event) => setValue(Number(event.target.value))} />
      </label>
      <label>
        nonce
        <input type="number" min={0} value={nonceInput} onChange={(event) => setNonceInput(Number(event.target.value))} />
      </label>
      <label>
        data
        <input value={data} onChange={(event) => setData(event.target.value)} placeholder="普通转账留空" />
      </label>
      <div className="row">
        <button type="button" onClick={() => submit("ok")}>
          提交合法交易
        </button>
        <button type="button" className="ghost" onClick={() => submit("nonce")}>
          提交错误 nonce
        </button>
        <button type="button" className="ghost" onClick={() => submit("balance")}>
          提交超额转账
        </button>
      </div>
      {last ? <Result ok={last.ok} testId="tx-result" text={last.text} /> : null}
      {last?.tx ? (
        <button
          type="button"
          className="ghost"
          onClick={() => downloadText("transaction.json", JSON.stringify(last.tx, null, 2), "application/json")}
        >
          下载这笔交易
        </button>
      ) : null}
    </LessonFrame>
  );
}
