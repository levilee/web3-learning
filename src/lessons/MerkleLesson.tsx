import { useMemo, useState } from "react";
import { prove, verifyProof } from "../crypto";
import { lessonById } from "../curriculum";
import { markCheck, useStore } from "../store";
import { Fields, LessonFrame, Result, downloadText } from "../ui";

export function MerkleLesson() {
  const lesson = lessonById("merkle");
  const store = useStore();
  const [blockIndex, setBlockIndex] = useState(0);
  const [leafIndex, setLeafIndex] = useState(0);
  const [edited, setEdited] = useState("");
  const [originalOk, setOriginalOk] = useState<boolean | null>(null);
  const [tamperOk, setTamperOk] = useState<boolean | null>(null);
  const block = store.ledger.blocks[Math.min(blockIndex, store.ledger.blocks.length - 1)];
  const proof = useMemo(() => (block ? prove(block.leaves, Math.min(leafIndex, block.leaves.length - 1)) : null), [block, leafIndex]);
  const selectedLeaf = block?.leaves[Math.min(leafIndex, block.leaves.length - 1)] ?? "";

  return (
    <LessonFrame
      lesson={lesson}
      inspector={
        <Fields
          rows={
            block && proof
              ? [
                  { name: "block", value: String(block.index) },
                  { name: "leaf", value: selectedLeaf },
                  { name: "leaf hash", value: proof.leafHash },
                  { name: "merkle root", value: proof.root },
                  ...proof.proof.map((step, index) => ({
                    name: `proof[${index}] ${step.side}`,
                    value: step.hash,
                  })),
                ]
              : []
          }
        />
      }
    >
      <p>创世块有 4 笔交易。选出一笔，先验证包含证明，再改叶子内容。</p>
      <div className="row">
        <label>
          块
          <select
            value={block?.index ?? 0}
            onChange={(event) => {
              setBlockIndex(Number(event.target.value));
              setLeafIndex(0);
              setEdited("");
              setOriginalOk(null);
              setTamperOk(null);
            }}
          >
            {store.ledger.blocks.map((item) => (
              <option key={item.index} value={item.index}>
                块 {item.index} · {item.leaves.length} 笔
              </option>
            ))}
          </select>
        </label>
        <label>
          交易
          <select
            value={Math.min(leafIndex, (block?.leaves.length ?? 1) - 1)}
            onChange={(event) => {
              const index = Number(event.target.value);
              setLeafIndex(index);
              setEdited(block?.leaves[index] ?? "");
              setOriginalOk(null);
              setTamperOk(null);
            }}
          >
            {block?.leaves.map((leaf, index) => (
              <option key={leaf} value={index}>
                {index} · {leaf.slice(0, 42)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <button
          type="button"
          onClick={() => {
            if (!proof) return;
            const ok = verifyProof(selectedLeaf, proof.proof, proof.root);
            setOriginalOk(ok);
            if (ok) markCheck("merkle", "proofOk");
          }}
        >
          验证包含证明
        </button>
      </div>
      {originalOk !== null ? <Result ok={originalOk} text={originalOk ? "包含证明通过。这片叶子在这个根下面。" : "原始证明没有通过。"} /> : null}
      <label>
        改过的叶子
        <textarea
          rows={3}
          value={edited || selectedLeaf}
          onChange={(event) => {
            setEdited(event.target.value);
            setTamperOk(null);
          }}
        />
      </label>
      <div className="row">
        <button
          type="button"
          onClick={() => {
            if (!proof) return;
            const leaf = `${selectedLeaf}x`;
            setEdited(leaf);
            const ok = verifyProof(leaf, proof.proof, proof.root);
            setTamperOk(ok);
            if (!ok) markCheck("merkle", "tamperFail");
          }}
        >
          改掉叶子后再验证
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            if (!proof) return;
            const leaf = edited || selectedLeaf;
            const ok = verifyProof(leaf, proof.proof, proof.root);
            setTamperOk(ok);
            if (!ok && leaf !== selectedLeaf) markCheck("merkle", "tamperFail");
          }}
        >
          用改过的叶子验证
        </button>
        {proof ? (
          <button
            type="button"
            className="ghost"
            onClick={() =>
              downloadText(
                "merkle-proof.json",
                JSON.stringify(
                  {
                    block: block?.index ?? 0,
                    leaf: selectedLeaf,
                    leafHash: proof.leafHash,
                    root: proof.root,
                    proof: proof.proof,
                    label: "模拟账本：没有测试网，没有共识",
                  },
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            下载包含证明
          </button>
        ) : null}
      </div>
      {tamperOk !== null ? (
        <Result ok={tamperOk} text={tamperOk ? "改过之后仍然通过。先改掉叶子里的一个字符。" : "同一份证明失败。根还是原来的根。"} />
      ) : null}
    </LessonFrame>
  );
}
