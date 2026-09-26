import type { ReactNode } from "react";
import type { DocInline } from "./types.js";

export function renderInline(inlines: readonly DocInline[]): ReactNode {
  return inlines.map((inline, index) => {
    if (typeof inline === "string") return inline;
    if ("code" in inline) {
      return (
        <code key={index} className="doc-inline-code">
          {inline.code}
        </code>
      );
    }
    const external = inline.a.href.startsWith("http");
    return (
      <a
        key={index}
        className="doc-link"
        href={inline.a.href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
      >
        {inline.a.label}
      </a>
    );
  });
}
