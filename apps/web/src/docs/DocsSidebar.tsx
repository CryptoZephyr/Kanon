import { DOCS_NAV } from "./docs-navigation.js";

export function DocsSidebar({
  activeHref,
  onNavigate,
}: {
  activeHref?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Docs">
      {DOCS_NAV.map((group) => (
        <div key={group.id} className="docs-nav-group">
          <span className="docs-nav-group-title">{group.title}</span>
          <ul className="docs-nav-list">
            {group.items.map((item) => (
              <li key={item.id}>
                <a
                  className={`docs-nav-link${item.href === activeHref ? " is-active" : ""}`}
                  href={item.href}
                  aria-current={item.href === activeHref ? "page" : undefined}
                  onClick={onNavigate}
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
