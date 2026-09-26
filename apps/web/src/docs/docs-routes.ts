import type { DocPageContent, DocSection } from "./types.js";
import { startPages } from "./pages/start/index.js";
import { usingKanonPages } from "./pages/using-kanon/index.js";
import { architecturePages } from "./pages/architecture/index.js";
import { referencePages } from "./pages/reference/index.js";
import { securityPages } from "./pages/security/index.js";
import { proofPages } from "./pages/proof/index.js";
import { helpPages } from "./pages/help/index.js";
import { flattenDocsNav } from "./docs-navigation.js";

export const DOC_SECTIONS: readonly DocSection[] = [
  { id: "start", title: "Start", pages: startPages },
  { id: "using-kanon", title: "Using Kanon", pages: usingKanonPages },
  { id: "architecture", title: "Architecture", pages: architecturePages },
  { id: "reference", title: "Reference", pages: referencePages },
  { id: "security", title: "Security", pages: securityPages },
  { id: "proof", title: "Proof", pages: proofPages },
  { id: "help", title: "Help", pages: helpPages },
];

export interface DocRouteLink {
  readonly title: string;
  readonly href: string;
}

export interface ResolvedDocRoute {
  readonly section: DocSection;
  readonly page: DocPageContent;
  readonly prev?: DocRouteLink;
  readonly next?: DocRouteLink;
}

const FLAT = flattenDocsNav();

export function resolveDocPath(
  pathname: string,
): ResolvedDocRoute | "index" | undefined {
  const match = /^\/docs(?:\/([^/]+))?(?:\/([^/]+))?\/?$/.exec(pathname);
  if (!match) return undefined;
  const [, sectionId, pageId] = match;
  if (!sectionId && !pageId) return "index";
  if (!pageId) {
    const section = DOC_SECTIONS.find((s) => s.id === sectionId);
    if (!section || section.pages.length === 0) return undefined;
    const first = section.pages[0];
    return resolveDocPath(`/docs/${section.id}/${first.id}`);
  }
  const section = DOC_SECTIONS.find((s) => s.id === sectionId);
  const page = section?.pages.find((p) => p.id === pageId);
  if (!section || !page) return undefined;

  const flatIndex = FLAT.findIndex(
    (entry) => entry.groupId === section.id && entry.item.id === page.id,
  );
  const prevEntry = flatIndex > 0 ? FLAT[flatIndex - 1] : undefined;
  const nextEntry =
    flatIndex >= 0 && flatIndex < FLAT.length - 1
      ? FLAT[flatIndex + 1]
      : undefined;

  return {
    section,
    page,
    prev: prevEntry
      ? { title: prevEntry.item.title, href: prevEntry.item.href }
      : undefined,
    next: nextEntry
      ? { title: nextEntry.item.title, href: nextEntry.item.href }
      : undefined,
  };
}

export function activeNavHref(pathname: string): string | undefined {
  const resolved = resolveDocPath(pathname);
  if (resolved === "index" || !resolved) return undefined;
  return `/docs/${resolved.section.id}/${resolved.page.id}`;
}
