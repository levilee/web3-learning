import { useState } from "react";
import { createAccount, publicKeyDigest } from "../crypto";
import { lessonById } from "../curriculum";
import { markCheck, saveAccount, useStore } from "../store";
import { Choice, Fields, LessonFrame, downloadText } from "../ui";
import { hexToBytes } from "@noble/hashes/utils.js";

export function AddressLesson() {
  const lesson = lessonById("address");
  const store = useStore();
  const account = store.account;
  const [note, setNote] = useState("");
  const parts = account ? publicKeyDigest(hexToBytes(account.publicKeyHex)) : null;

  return (
    <LessonFrame
      lesson={lesson}
      inspector={
        <Fields
          rows={
            account
              ? [
                  { name: "public key", value: account.publicKeyHex },
                  { name: "keccak256", value: parts?.digestHex ?? "" },
                  { name: "address", value: parts?.address ?? "", note: "摘要的末 20 字节" },
                  { name: "issuer", value: "无", note: "地址不是证书 subject" },
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
          const next = account ?? createAccount();
          if (!account) saveAccount(next);
          const check = publicKeyDigest(hexToBytes(next.publicKeyHex));
          if (check.address === next.address) markCheck("address", "derived");
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
              setNote("字段检查器里的 issuer 是无。地址来自公钥摘要。");
            }
          }}
        />
      ) : null}
      {account && parts ? (
        <button
          type="button"
          className="ghost"
          onClick={() =>
            downloadText(
              "address.json",
              JSON.stringify(
                {
                  publicKey: account.publicKeyHex,
                  keccak256: parts.digestHex,
                  address: parts.address,
                  issuer: null,
                },
                null,
                2,
              ),
              "application/json",
            )
          }
        >
          下载地址推导
        </button>
      ) : null}
      {note ? <p>{note}</p> : null}
    </LessonFrame>
  );
}
