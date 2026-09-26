import type { DocInline } from "./types.js";
import { renderInline } from "./render-inline.js";

const KIND_LABELS = {
  note: "Note",
  warning: "Warning",
  boundary: "Boundary",
} as const;

export function Callout({
  kind,
  title,
  text,
}: {
  kind: keyof typeof KIND_LABELS;
  title?: string;
  text: readonly DocInline[];
}) {
  return (
    <aside className={`doc-callout doc-callout-${kind}`}>
      <div className="doc-callout-title">{title ?? KIND_LABELS[kind]}</div>
      <p>{renderInline(text)}</p>
    </aside>
  );
}
