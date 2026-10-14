import { useEffect, useState } from "react";
import { AddressLesson } from "./lessons/AddressLesson";
import { CaLesson } from "./lessons/CaLesson";
import { ContractLesson } from "./lessons/ContractLesson";
import { HashLesson } from "./lessons/HashLesson";
import { MerkleLesson } from "./lessons/MerkleLesson";
import { TxLesson } from "./lessons/TxLesson";
import { VcLesson } from "./lessons/VcLesson";
import { Home, Shell } from "./ui";

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  return (
    <Shell>
      {hash === "#/hash" ? <HashLesson /> : null}
      {hash === "#/ca" ? <CaLesson /> : null}
      {hash === "#/address" ? <AddressLesson /> : null}
      {hash === "#/merkle" ? <MerkleLesson /> : null}
      {hash === "#/tx" ? <TxLesson /> : null}
      {hash === "#/contract" ? <ContractLesson /> : null}
      {hash === "#/vc" ? <VcLesson /> : null}
      {hash === "#/" || hash === "" ? <Home /> : null}
      {!["#/", "", "#/hash", "#/ca", "#/address", "#/merkle", "#/tx", "#/contract", "#/vc"].includes(hash) ? (
        <p className="missing">
          没有这一页。<a href="#/">回到路径</a>
        </p>
      ) : null}
    </Shell>
  );
}
