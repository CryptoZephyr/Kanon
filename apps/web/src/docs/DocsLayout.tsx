import type { ReactNode } from "react";
import { DOCS_NAV } from "./docs-navigation.js";
import { DOC_SECTIONS, activeNavHref, resolveDocPath } from "./docs-routes.js";
import { DocsSidebar } from "./DocsSidebar.js";
import { DocsMobileNav } from "./DocsMobileNav.js";
import { DocsOnThisPage } from "./DocsOnThisPage.js";
import { DocsSearch } from "./DocsSearch.js";
import { DocPage, pageHeadings } from "./DocPage.js";

function Logo() {
  return (
    <span className="docs-wordmark">
      KANON <span className="docs-wordmark-docs">DOCS</span>
    </span>
  );
}

function DocsIndex() {
  return (
    <article className="doc-index">
      <h1>Kanon documentation</h1>
      <p className="doc-page-lede">
        How the authority lifecycle works, how to run it on the hosted demo, and
        what the live deployment actually proves. Source of truth: the code and
        the recorded evidence.
      </p>
      {DOCS_NAV.map((group) => {
        const section = DOC_SECTIONS.find((s) => s.id === group.id);
        return (
          <section key={group.id} className="doc-index-section">
            <h2>{group.title}</h2>
            <ul className="doc-index-list">
              {group.items.map((item) => {
                const page = section?.pages.find((p) => p.id === item.id);
                return (
                  <li key={item.id}>
                    <a className="doc-index-link" href={item.href}>
                      <span className="doc-index-title">{item.title}</span>
                      {page ? (
                        <span className="doc-index-desc">
                          {page.description}
                        </span>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </article>
  );
}

export function DocsLayout({
  children,
  path,
}: {
  children?: ReactNode;
  path: string;
}) {
  const route = resolveDocPath(path);
  const activeHref = activeNavHref(path);
  const headings = route && route !== "index" ? pageHeadings(route.page) : [];

  let content: ReactNode;
  if (children) {
    content = children;
  } else if (route === "index") {
    content = <DocsIndex />;
  } else if (route) {
    content = <DocPage route={route} />;
  } else {
    content = (
      <article className="doc-page">
        <h1>Not found</h1>
        <p className="doc-page-lede">
          This docs page does not exist.{" "}
          <a className="doc-link" href="/docs">
            Back to the docs index
          </a>
          .
        </p>
      </article>
    );
  }

  return (
    <div className="docs-root">
      <header className="docs-header">
        <a className="docs-logo-link" href="/docs">
          <Logo />
        </a>
        <div className="docs-header-right">
          <DocsSearch />
          <a className="nav-link" href="/">
            Workspace
          </a>
        </div>
      </header>
      <div className="docs-body">
        <aside className="docs-sidebar">
          <DocsSidebar activeHref={activeHref} />
        </aside>
        <DocsMobileNav activeHref={activeHref} />
        <main className="docs-content">{content}</main>
        <DocsOnThisPage headings={headings} />
      </div>
    </div>
  );
}
