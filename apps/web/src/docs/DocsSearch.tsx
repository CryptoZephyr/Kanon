import { useEffect, useMemo, useRef, useState } from "react";
import { DOC_SECTIONS } from "./docs-routes.js";
import { pageHeadings } from "./DocPage.js";

interface SearchEntry {
  readonly title: string;
  readonly section: string;
  readonly href: string;
}

const INDEX: SearchEntry[] = DOC_SECTIONS.flatMap((section) =>
  section.pages.flatMap((page) => [
    {
      title: page.title,
      section: section.title,
      href: `/docs/${section.id}/${page.id}`,
    },
    ...pageHeadings(page).map((heading) => ({
      title: heading.text,
      section: `${section.title} — ${page.title}`,
      href: `/docs/${section.id}/${page.id}#${heading.id}`,
    })),
  ]),
);

export function DocsSearch() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return INDEX.filter(
      (entry) =>
        entry.title.toLowerCase().includes(needle) ||
        entry.section.toLowerCase().includes(needle),
    ).slice(0, 10);
  }, [query]);

  const showPanel = focused && query.trim().length >= 2;

  return (
    <div className="docs-search" ref={rootRef}>
      <input
        className="docs-search-input"
        type="search"
        placeholder="Search docs"
        aria-label="Search docs"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setFocused(false);
        }}
      />
      {showPanel ? (
        results.length > 0 ? (
          <ul className="docs-search-results">
            {results.map((entry) => (
              <li key={entry.href}>
                <a
                  className="docs-search-result-link"
                  href={entry.href}
                  onClick={() => {
                    setFocused(false);
                    setQuery("");
                  }}
                >
                  <span>{entry.title}</span>
                  <span className="docs-search-result-section">
                    {entry.section}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="docs-search-empty">No matches for “{query}”.</p>
        )
      ) : null}
    </div>
  );
}
