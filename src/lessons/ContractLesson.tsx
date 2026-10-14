import { useState } from "react";
import { createAccount } from "../crypto";
import { lessonById } from "../curriculum";
import { applyBlock, buildTx, CONTRACT, namedAccounts, type Tx } from "../ledger";
import { getState, markCheck, saveAccount, saveLedger, useStore } from "../store";
import { Choice, Fields, LessonFrame, Result } from "../ui";

export function ContractLesson() {
  const lesson = lessonById("contract");
  const store = useStore();
  const { bob } = namedAccounts();
  const [last, setLast] = useState<{ ok: boolean; text: string; tx?: Tx } | null>(null);
  const [note, setNote] = useState("");
  const account = store.account;
  const storage = store.ledger.storage.count;

  function submit(kind: "transfer" | "call") {
    const signer = account ?? createAccount();
    if (!account) saveAccount(signer);
    const ledger = getState().ledger;
    const current = ledger.accounts[signer.address];
    const tx = buildTx(ledger, signer, {
      to: kind === "call" ? CONTRACT : bob.address,
      value: kind === "call" ? 0 : current.balance > 0 ? 1 : 0,
      data: kind === "call" ? `setCount:${storage + 1}` : "",
      nonce: current.nonce,
    });
    const applied = applyBlock(ledger, [tx]);
    if (!applied.ok) {
      setLast({ ok: false, text: applied.reason, tx });
      return;
    }
    saveLedger(applied.ledger);
    setLast({
      ok: true,
      text: kind === "call" ? "调用入账。存储变了，data 里是 setCount。" : "转账入账。data 是空的，存储没有变。",
      tx,
    });
    markCheck("contract", kind);
  }

  return (
    <LessonFrame
      lesson={lesson}
      inspector={
        <Fields
          rows={[
            { name: "contract", value: CONTRACT },
            { name: "storage.count", value: String(storage), note: "状态在这里，不在 data 里" },
            ...(last?.tx
              ? [
                  { name: "to", value: last.tx.to },
                  { name: "value", value: String(last.tx.value) },
                  { name: "data", value: last.tx.data || "(空)" },
                  { name: "nonce", value: String(last.tx.nonce) },
                ]
              : []),
          ]}
        />
      }
    >
      <p>先做一笔普通转账，再调用合约把 count 写成下一个整数。两边都进同一份模拟账本。</p>
      <p className="mono">storage.count = {storage}</p>
      <div className="row">
        <button type="button" onClick={() => submit("transfer")}>
          普通转账
        </button>
        <button type="button" onClick={() => submit("call")}>
          调用 setCount
        </button>
      </div>
      {last ? <Result ok={last.ok} text={last.text} /> : null}
      <Choice
        name="状态写在哪里？"
        options={[
          { id: "data", label: "交易的 data 字段" },
          { id: "balance", label: "账户余额" },
          { id: "storage", label: "合约存储", correct: true },
        ]}
        onPick={(_id, correct) => {
          if (correct) {
            markCheck("contract", "storageAnswer");
            setNote("对。data 只是参数，写完的 count 在存储里。");
          } else setNote("看字段检查器里的 storage.count。data 里只有这次调用的参数。");
        }}
      />
      <Choice
        name="调用和普通转账的差别看哪个字段？"
        options={[
          { id: "nonce", label: "nonce" },
          { id: "data", label: "data", correct: true },
          { id: "value", label: "value" },
        ]}
        onPick={(_id, correct) => {
          if (correct) {
            markCheck("contract", "dataAnswer");
            setNote("对。转账的 data 是空的，调用的 data 是 setCount。");
          } else setNote("对比两笔交易的 data。");
        }}
      />
      {note ? <p>{note}</p> : null}
    </LessonFrame>
  );
}
