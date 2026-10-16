import type { ReactNode } from "react";
import { LESSONS, type LessonMeta } from "./curriculum";
import { resetProgress, useStore } from "./store";

export function passed(lesson: LessonMeta, checks: Record<string, boolean> | undefined): boolean {
  return lesson.checks.every((check) => checks?.[check.id]);
}

export function Badge({ kind }: { kind: "real" | "sim" }) {
  return <span className={kind === "real" ? "badge real" : "badge sim"}>{kind === "real" ? "真验证" : "模拟账本"}</span>;
}

export function Status({ done }: { done: boolean }) {
  return <span className={done ? "status done" : "status idle"}>{done ? "已通过" : "未开始"}</span>;
}

export function Shell({ children }: { children: ReactNode }) {
  const store = useStore();
  const hash = typeof window === "undefined" ? "#/" : window.location.hash || "#/";
  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="#/">
          <span className="brand-kicker">浏览器实验</span>
          <strong>Web3 学习站</strong>
        </a>
        <nav>
          {LESSONS.map((lesson) => {
            const done = passed(lesson, store.progress[lesson.id]);
            const active = hash === lesson.path;
            return (
              <a key={lesson.id} href={lesson.path} className={active ? "nav-link active" : "nav-link"} aria-current={active ? "page" : undefined}>
                <span>{lesson.number}</span>
                {done ? <i /> : null}
              </a>
            );
          })}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}

export function Home() {
  const store = useStore();
  const doneCount = LESSONS.filter((lesson) => passed(lesson, store.progress[lesson.id])).length;
  return (
    <section className="home">
      <p className="eyebrow">给已经在管证书的人</p>
      <h1>七课，从证书走到 VC / VP</h1>
      <p className="lede">
        签名、证书、地址和凭证在页面里做真实验证。区块、交易和合约共用一份本地模拟账本，页面会写明它不是测试网。进度只留在这台浏览器里。
      </p>
      <div className="legend">
        <Badge kind="real" />
        <span>结果由浏览器里的密码学计算得出。</span>
        <Badge kind="sim" />
        <span>本地状态机。没有测试网，没有共识，没有真 EVM。</span>
      </div>
      <p className="progress-line">
        已通过 {doneCount} / {LESSONS.length}
      </p>
      <ol className="path">
        {LESSONS.map((lesson) => {
          const done = passed(lesson, store.progress[lesson.id]);
          return (
            <li key={lesson.id}>
              <a href={lesson.path} data-testid={`path-${lesson.id}`} data-status={done ? "已通过" : "未开始"}>
                <span className="num">{lesson.number}</span>
                <span>
                  <strong>{lesson.title}</strong>
                  <em>{lesson.summary}</em>
                </span>
                <Badge kind={lesson.kind} />
                <Status done={done} />
              </a>
            </li>
          );
        })}
      </ol>
      <p className="scope">不在这条路径里：节点运维、共识与最终性、代币授权、DeFi、跨链。</p>
      <button
        type="button"
        className="ghost danger"
        onClick={() => {
          if (window.confirm("清除这台浏览器里的进度、账户和模拟账本？")) resetProgress();
        }}
      >
        重置本机进度
      </button>
    </section>
  );
}

export function LessonFrame({
  lesson,
  children,
  inspector,
}: {
  lesson: LessonMeta;
  children: ReactNode;
  inspector: ReactNode;
}) {
  const store = useStore();
  const checks = store.progress[lesson.id];
  const done = passed(lesson, checks);
  const next = LESSONS[lesson.number] ?? null;
  return (
    <article className="lesson">
      <p className="crumb">
        <a href="#/">路径</a>
        <span>/</span>
        第 {lesson.number} 课
      </p>
      <div className="lesson-title">
        <h1>{lesson.title}</h1>
        <Badge kind={lesson.kind} />
        <Status done={done} />
      </div>
      <p className="model">{lesson.model}</p>
      <p className={lesson.kind === "sim" ? "sim-note" : "honesty"} data-testid="honesty">
        {lesson.honesty}
      </p>
      <div className="work">
        <section className="lab">{children}</section>
        <aside className="inspector">
          <h2>字段检查器</h2>
          {inspector}
        </aside>
      </div>
      <section className="checks">
        <h2>通过条件</h2>
        <ul>
          {lesson.checks.map((check) => (
            <li key={check.id} className={checks?.[check.id] ? "on" : ""} data-check={check.id} data-done={checks?.[check.id] ? "yes" : "no"}>
              {check.label}
            </li>
          ))}
        </ul>
        {done && next ? (
          <a className="next" href={next.path}>
            下一课：{next.title}
          </a>
        ) : null}
        {done && !next ? <p className="next-done">七课都走完了。可以回到路径看每一课的标记。</p> : null}
      </section>
    </article>
  );
}

export function Fields({ rows }: { rows: { name: string; value: string; note?: string }[] }) {
  if (rows.length === 0) return <p className="empty">还没有产物。</p>;
  return (
    <dl className="fields">
      {rows.map((row) => (
        <div key={row.name}>
          <dt>{row.name}</dt>
          <dd>
            {row.value}
            {row.note ? <small>{row.note}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Result({ ok, text, testId }: { ok: boolean; text: string; testId?: string }) {
  return (
    <p className={ok ? "result ok" : "result bad"} data-testid={testId}>
      {text}
    </p>
  );
}

export function Choice({
  name,
  options,
  onPick,
}: {
  name: string;
  options: { id: string; label: string; correct?: boolean }[];
  onPick: (id: string, correct: boolean) => void;
}) {
  return (
    <fieldset className="choice">
      <legend>{name}</legend>
      {options.map((option) => (
        <label key={option.id}>
          <input
            type="radio"
            name={name}
            onChange={() => onPick(option.id, Boolean(option.correct))}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

export function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

