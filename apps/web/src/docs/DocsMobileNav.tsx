import { useState } from "react";
import { DocsSidebar } from "./DocsSidebar.js";

export function DocsMobileNav({ activeHref }: { activeHref?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="docs-mobile-panel">
      <button
        type="button"
        className="docs-mobile-nav-button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close docs menu" : "Docs menu"}
      </button>
      {open ? (
        <DocsSidebar
          activeHref={activeHref}
          onNavigate={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
