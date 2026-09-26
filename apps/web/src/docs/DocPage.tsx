import type { DocBlock, DocPageContent } from "./types.js";
import type { ResolvedDocRoute } from "./docs-routes.js";
import { renderInline } from "./render-inline.js";
import { CodeBlock } from "./CodeBlock.js";
import { Callout } from "./Callout.js";
import { ErrorReference } from "./ErrorReference.js";

function renderBlock(block: DocBlock, index: number) {
  switch (block.t) {
    case "p":
      return (
        <p key={index} className="doc-p">
          {renderInline(block.text)}
        </p>
      );
    case "h2":
      return (
        <h2 key={index} id={block.id} className="doc-h2">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={index} id={block.id} className="doc-h2">
          {block.text}
        </h3>
      );
    case "code":
      return (
        <CodeBlock
          key={index}
          text={block.text}
          label={block.label}
          copy={block.copy}
        />
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag key={index} className="doc-list">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </Tag>
      );
    }
    case "callout":
      return (
        <Callout
          key={index}
          kind={block.kind}
          title={block.title}
          text={block.text}
        />
      );
    case "table":
      return (
        <div key={index} className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                {block.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "flow":
      return (
        <ol key={index} className="doc-flow">
          {block.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      );
    case "kv":
      return (
        <dl key={index} className="doc-kv">
          {block.rows.map(([label, value]) => (
            <li key={label}>
              <dt>{label}</dt>
              <dd>{renderInline(value)}</dd>
            </li>
          ))}
        </dl>
      );
    case "error":
      return <ErrorReference key={index} rows={block.rows} />;
    default:
      return null;
  }
}

export function DocPage({ route }: { route: ResolvedDocRoute }) {
  const { page, prev, next } = route;
  return (
    <article className="doc-page">
      <h1>{page.title}</h1>
      <p className="doc-page-lede">{page.description}</p>
      {page.blocks.map(renderBlock)}
      <nav className="doc-pagenav" aria-label="Page">
        <div>
          {prev ? (
            <a className="doc-pagenav-link doc-pagenav-prev" href={prev.href}>
              <span className="doc-pagenav-dir">Previous</span>
              <span className="doc-pagenav-title">{prev.title}</span>
            </a>
          ) : null}
        </div>
        <div className="doc-pagenav-next">
          {next ? (
            <a className="doc-pagenav-link" href={next.href}>
              <span className="doc-pagenav-dir">Next</span>
              <span className="doc-pagenav-title">{next.title}</span>
            </a>
          ) : null}
        </div>
      </nav>
    </article>
  );
}

export function pageHeadings(page: DocPageContent) {
  return page.blocks
    .filter(
      (block): block is Extract<DocBlock, { t: "h2" | "h3" }> =>
        block.t === "h2" || block.t === "h3",
    )
    .map((block) => ({ id: block.id, text: block.text }));
}
