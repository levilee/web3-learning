export type LessonId = "hash" | "ca" | "address" | "merkle" | "tx" | "contract" | "vc";

export type Check = {
  id: string;
  label: string;
};

export type LessonMeta = {
  id: LessonId;
  number: number;
  title: string;
  kind: "real" | "sim";
  path: string;
  summary: string;
  model: string;
  checks: Check[];
};

export const LESSONS: LessonMeta[] = [
  {
    id: "hash",
    number: 1,
    title: "哈希与签名",
    kind: "real",
    path: "#/hash",
    summary: "改一个字节，哈希就变了。签名只对原来的文字有效。",
    model: "SHA-256 把任意文字收成固定长度的摘要。同一段文字得到同一个哈希；改一个字节，摘要就完全不同。签名是私钥对这段文字的 SHA-256 摘要签字，验证时用公钥。文字被改过之后，原来的签名对不上。",
    checks: [
      { id: "hashChanged", label: "改一个字节后，哈希变了" },
      { id: "signedOk", label: "原始文字的签名验证通过" },
      { id: "tamperedFail", label: "篡改文字后，签名验证失败" },
      { id: "reason", label: "指出失败原因是文字被改过" },
    ],
  },
  {
    id: "ca",
    number: 2,
    title: "CA 签发、验证、吊销",
    kind: "real",
    path: "#/ca",
    summary: "用 CA 公钥验证证书。错误的 CA 和教学吊销名单都会让它失败。",
    model: "CA 用自己的私钥签发证书。验证方拿着 CA 的公钥，核对叶子证书上的签名。证书字段与 X.509 对齐：issuer、subject、validity、key usage。吊销在这课是一份存在浏览器里的序列号名单，页面不连接 OCSP。",
    checks: [
      { id: "verifyOk", label: "正确的 CA 验证通过" },
      { id: "wrongCa", label: "另一把 CA 验证失败" },
      { id: "revoked", label: "序列号进入教学吊销名单后失败" },
    ],
  },
  {
    id: "address",
    number: 3,
    title: "私钥到地址",
    kind: "real",
    path: "#/address",
    summary: "地址是公钥的摘要。这张身份没有 issuer。",
    model: "账户地址不是证书。这把密钥是 secp256k1。地址取未压缩公钥去掉 0x04 之后做 keccak256，再留下最后 20 字节。没有 CA 在 issuer 栏里为它背书。这把密钥会带到第 5 课当账户。",
    checks: [
      { id: "derived", label: "从公钥推导出地址" },
      { id: "noIssuer", label: "指出这个地址没有 issuer" },
    ],
  },
  {
    id: "merkle",
    number: 4,
    title: "区块与默克尔",
    kind: "sim",
    path: "#/merkle",
    summary: "交易是叶子。包含证明能验过，改过的叶子验不过。",
    model: "模拟账本把一个块里的交易当作叶子，两两做 SHA-256，得到 Merkle 根。包含证明给出从叶子走到根的兄弟哈希。叶子被改过之后，同一份证明对不上原来的根。这里没有测试网，也没有共识。",
    checks: [
      { id: "proofOk", label: "原始叶子的包含证明通过" },
      { id: "tamperFail", label: "改过的叶子用同一份证明失败" },
    ],
  },
  {
    id: "tx",
    number: 5,
    title: "交易字段",
    kind: "sim",
    path: "#/tx",
    summary: "签名是真的。错误 nonce 和余额不足会被账本拒绝。",
    model: "一笔交易写清 from、to、value、nonce、data，并用 from 的私钥签名。账本只接受下一笔序号，也只接受余额够的转账。签名在浏览器里真实验证。入账的账本仍是本地状态机。",
    checks: [
      { id: "accepted", label: "一笔合法交易入账" },
      { id: "badNonce", label: "错误 nonce 被拒绝，并能看到原因" },
      { id: "lowBalance", label: "余额不足被拒绝，并能看到原因" },
    ],
  },
  {
    id: "contract",
    number: 6,
    title: "合约如何改状态",
    kind: "sim",
    path: "#/contract",
    summary: "状态写在存储里。调用和转账的差别在 data。",
    model: "这笔调用没有字节码，没有 gas 市场，也没有真 EVM。合约状态放在存储里。交易的 data 只带着这次调用的参数。普通转账的 data 是空的，存储不变。",
    checks: [
      { id: "transfer", label: "提交一笔 data 为空的转账" },
      { id: "call", label: "提交一笔写存储的调用" },
      { id: "storageAnswer", label: "指出状态在合约存储里" },
      { id: "dataAnswer", label: "指出调用和转账的差别在 data" },
    ],
  },
  {
    id: "vc",
    number: 7,
    title: "DID、VC、VP",
    kind: "real",
    path: "#/vc",
    summary: "issuer 是 DID。VP 是持有者的出示，验证方检查签名、有效期和声明。",
    model: "第 2 课的 issuer 是目录里的 CA，持有者不能只出示其中一项声明。这里的 issuer 是 did:key，公钥编在 DID 里。VC 由 issuer 签名。VP 由持有者签名，用来出示那张 VC。验证方检查两层签名、有效期、role 声明，以及本课的本地状态名单。",
    checks: [
      { id: "valid", label: "有效 VP 被接受" },
      { id: "expired", label: "过期凭证的出示被拒绝" },
      { id: "missing", label: "缺少 role 声明的出示被拒绝" },
      { id: "revoked", label: "进入本地状态名单后被拒绝" },
    ],
  },
];

export function lessonById(id: LessonId): LessonMeta {
  const lesson = LESSONS.find((item) => item.id === id);
  if (!lesson) throw new Error(id);
  return lesson;
}
