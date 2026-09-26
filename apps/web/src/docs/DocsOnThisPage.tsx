export function DocsOnThisPage({
  headings,
}: {
  headings: readonly { id: string; text: string }[];
}) {
  if (headings.length === 0) return null;
  return (
    <nav className="doc-toc" aria-label="On this page">
      <span className="docs-nav-group-title">On this page</span>
      <ul className="doc-toc-list">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a className="doc-toc-link" href={`#${heading.id}`}>
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
