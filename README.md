# web3-learning

浏览器里的 Web3 学习站，面向已有证书和运维经验的人。

路径共 7 课：哈希与签名，CA 签发、验证和吊销，私钥到地址，区块与默克尔证明，交易字段，合约如何改状态，DID、VC、VP。签名、证书和 VC / VP 在页面里做真实验证。第 4 到第 6 课共用一份标明的本地模拟账本，没有测试网，也没有共识。第 3 课的密钥可以当作第 5 课的账户。

不在这条路径里：节点运维、共识与最终性、代币授权、DeFi、跨链、账号和后端。

站点文件在 `gh-pages` 分支。仓库的 Settings → Pages 里把来源选成 `gh-pages` 分支、目录 `/ (root)` 之后，公网地址是 <https://levilee.github.io/web3-learning/>。之后推到 `main`，GitHub Actions 会更新这个地址。

本地开发：

```bash
npm install
npm run dev
```

打开本地页面后，从首页按顺序做实验。进度、账户和模拟账本存在浏览器本地。`npm test` 检查签名、证书、默克尔、账本和 VC/VP。`npm run build` 生成静态文件，生产构建的资源路径是 `/web3-learning/`。推到 `main` 后，GitHub Actions 会把站点发布到上面的地址。
