import { useState } from "react";
import { addressFromPublicKey, createAccount } from "../crypto";
import { lessonById } from "../curriculum";
import { markCheck, saveAccount, useStore } from "../store";
import { Choice, Fields, LessonFrame } from "../ui";
import { hexToBytes } from "@noble/hashes/utils.js";

export function AddressLesson() {
  const lesson = lessonById("address");
  const store = useStore();
  const account = store.account;
  const [note, setNote] = useState("");
  const derived = account ? addressFromPublicKey(hexToBytes(account.publicKeyHex)) : "";

  return (
    <LessonFrame
      lesson={lesson}
      inspector={
        <Fields
          rows={
            account
              ? [
                  { name: "public key", value: account.publicKeyHex },
                  { name: "keccak256 → address", value: derived },
                  { name: "issuer", value: "(没有)", note: "地址不是证书 subject" },
                ]
              : []
          }
        />
      }
    >
      <p>生成 secp256k1 密钥。地址只从公钥算出来，没有人签发它。</p>
      <button
        type="button"
        onClick={() => {
          if (!account) saveAccount(createAccount());
          markCheck("address", "derived");
        }}
      >
        {account ? "这把密钥已经推导出地址" : "生成密钥并推导地址"}
      </button>
      {account ? <p className="mono">{account.address}</p> : null}
      {account ? (
        <Choice
          name="这个地址靠什么被信任？"
          options={[
            { id: "ca", label: "某个 CA 写在 issuer 栏里" },
            { id: "digest", label: "它是公钥摘要，没有 issuer", correct: true },
            { id: "miner", label: "出块的人给它签名" },
          ]}
          onPick={(_id, correct) => {
            if (correct) {
              markCheck("address", "noIssuer");
              setNote("对。这张身份没有 issuer。第 5 课会用同一把密钥当账户。");
            } else {
              setNote("字段检查器里的 issuer 是空的。地址来自公钥摘要。");
            }
          }}
        />
      ) : null}
      {note ? <p>{note}</p> : null}
    </LessonFrame>
  );
}
