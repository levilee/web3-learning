import { useState } from "react";
import { createAccount } from "../crypto";
import { lessonById } from "../curriculum";
import { applyBlock, buildTx, namedAccounts, type Tx } from "../ledger";
import { getState, markCheck, saveAccount, saveLedger, useStore } from "../store";
import { Fields, LessonFrame, Result } from "../ui";

export function TxLesson() {
  const lesson = lessonById("tx");
  const store = useStore();
  const { bob } = namedAccounts();
  const [value, setValue] = useState(1);
  const [last, setLast] = useState<{ ok: boolean; text: string; tx?: Tx } | null>(null);
  const account = store.account;
  const balance = account ? (store.ledger.accounts[account.address]?.balance ?? 0) : 0;
  const nonce = account ? (store.ledger.accounts[account.address]?.nonce ?? 0) : 0;

  function submit(kind: "ok" | "nonce" | "balance") {
    const signer = account ?? createAccount();
    if (!account) saveAccount(signer);
    const ledger = getState().ledger;
    const current = ledger.accounts[signer.address];
    const tx = buildTx(ledger, signer, {
      to: bob.address,
      value: kind === "balance" ? current.balance + 10 : Math.max(1, value),
      data: "",
      nonce: kind === "nonce" ? current.nonce + 3 : current.nonce,
    });
    const applied = applyBlock(ledger, [tx]);
    if (applied.ok) {
      saveLedger(applied.ledger);
      setLast({ ok: true, text: "交易入账。nonce 已加一，余额已扣减。", tx });
      markCheck("tx", "accepted");
      return;
    }
    setLast({ ok: false, text: applied.reason, tx });
    if (kind === "nonce") markCheck("tx", "badNonce");
    if (kind === "balance") markCheck("tx", "lowBalance");
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
        value
        <input type="number" min={1} value={value} onChange={(event) => setValue(Number(event.target.value))} />
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
      {last ? <Result ok={last.ok} text={last.text} /> : null}
    </LessonFrame>
  );
}
