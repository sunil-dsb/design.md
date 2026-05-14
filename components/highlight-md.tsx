import type { ReactNode } from "react";

// Lightweight regex highlighter for the DESIGN.md preview. Used by both the
// server-rendered <SpecPreview> wrapper and the client-rendered <SpecTabs>
// since the latter swaps content reactively. No runtime cost on the static
// path  the result is just plain spans.
//
// Targets the two languages a DESIGN.md typically mixes: YAML in the
// front-matter block, markdown below it. Plus a couple of inline tokens
// (bold, inline-code, hex colours).

const YAML_KEY = /^(\s*)([A-Za-z][\w-]*)(\s*:\s*)(.*)$/;
const MD_LIST = /^(\s*)(-\s)(.*)$/;
const QUOTED = /^(".*"|'.*')$/;
const HEX = /^#[0-9a-fA-F]{3,8}$/;

export function HighlightedMd({ source }: { source: string }): ReactNode {
  const lines = source.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {renderLine(line)}
          {i < lines.length - 1 && "\n"}
        </span>
      ))}
    </>
  );
}

function renderLine(line: string): ReactNode {
  if (/^---\s*$/.test(line)) {
    return <span className="text-white/30">{line}</span>;
  }
  if (/^#{1,6}\s/.test(line)) {
    return <span className="font-semibold text-primary">{line}</span>;
  }

  const list = line.match(MD_LIST);
  if (list) {
    return (
      <>
        {list[1]}
        <span className="text-primary/70">{list[2]}</span>
        <span className="text-white/80">{renderInline(list[3])}</span>
      </>
    );
  }

  const yaml = line.match(YAML_KEY);
  if (yaml) {
    return (
      <>
        {yaml[1]}
        <span className="text-primary">{yaml[2]}</span>
        <span className="text-white/40">{yaml[3]}</span>
        <span className="text-white/85">{renderValue(yaml[4])}</span>
      </>
    );
  }

  return <span className="text-white/75">{renderInline(line)}</span>;
}

function renderInline(text: string): ReactNode {
  const tokens: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|#[0-9a-fA-F]{3,8})/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) tokens.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      tokens.push(
        <span key={key++} className="font-semibold text-white">
          {token.slice(2, -2)}
        </span>,
      );
    } else if (token.startsWith("`")) {
      tokens.push(
        <span
          key={key++}
          className="rounded bg-white/10 px-1 text-[0.95em] text-white/90"
        >
          {token.slice(1, -1)}
        </span>,
      );
    } else {
      tokens.push(
        <span key={key++} className="text-primary">
          {token}
        </span>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens.length ? tokens : text;
}

function renderValue(value: string): ReactNode {
  const trimmed = value.trim();
  if (QUOTED.test(trimmed)) {
    return <span className="text-emerald-300/80">{value}</span>;
  }
  if (HEX.test(trimmed)) {
    return <span className="text-primary">{value}</span>;
  }
  if (/^-?\d+(\.\d+)?(px|rem|em|%)?$/.test(trimmed)) {
    return <span className="text-amber-300/80">{value}</span>;
  }
  return value;
}
