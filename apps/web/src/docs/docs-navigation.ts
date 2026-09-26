export interface DocNavItem {
  readonly id: string;
  readonly title: string;
  readonly href: string;
}

export interface DocNavGroup {
  readonly id: string;
  readonly title: string;
  readonly items: readonly DocNavItem[];
}

export const DOCS_NAV: readonly DocNavGroup[] = [
  {
    id: "start",
    title: "Start",
    items: [
      {
        id: "introduction",
        title: "Introduction",
        href: "/docs/start/introduction",
      },
      { id: "why-kanon", title: "Why Kanon", href: "/docs/start/why-kanon" },
      {
        id: "how-it-works",
        title: "How it works",
        href: "/docs/start/how-it-works",
      },
      { id: "try-kanon", title: "Try Kanon", href: "/docs/start/try-kanon" },
    ],
  },
  {
    id: "using-kanon",
    title: "Using Kanon",
    items: [
      {
        id: "start-a-run",
        title: "Start a run",
        href: "/docs/using-kanon/start-a-run",
      },
      {
        id: "register-release",
        title: "Register a release",
        href: "/docs/using-kanon/register-release",
      },
      {
        id: "define-authority",
        title: "Define authority",
        href: "/docs/using-kanon/define-authority",
      },
      {
        id: "approve-authority",
        title: "Approve authority",
        href: "/docs/using-kanon/approve-authority",
      },
      {
        id: "run-actions",
        title: "Run actions",
        href: "/docs/using-kanon/run-actions",
      },
      {
        id: "update-and-reauthorize",
        title: "Update and reauthorize",
        href: "/docs/using-kanon/update-and-reauthorize",
      },
      { id: "revoke", title: "Revoke", href: "/docs/using-kanon/revoke" },
      {
        id: "review-evidence",
        title: "Review evidence",
        href: "/docs/using-kanon/review-evidence",
      },
      { id: "recovery", title: "Recovery", href: "/docs/using-kanon/recovery" },
    ],
  },
  {
    id: "architecture",
    title: "Architecture",
    items: [
      {
        id: "authority-model",
        title: "Authority model",
        href: "/docs/architecture/authority-model",
      },
      {
        id: "authorization",
        title: "Authorization",
        href: "/docs/architecture/authorization",
      },
      {
        id: "installation-lifecycle",
        title: "Installation lifecycle",
        href: "/docs/architecture/installation-lifecycle",
      },
      { id: "runner", title: "Runner", href: "/docs/architecture/runner" },
      {
        id: "verification",
        title: "Verification",
        href: "/docs/architecture/verification",
      },
    ],
  },
  {
    id: "reference",
    title: "Reference",
    items: [
      {
        id: "supported-networks",
        title: "Supported networks",
        href: "/docs/reference/supported-networks",
      },
      {
        id: "supported-assets",
        title: "Supported assets",
        href: "/docs/reference/supported-assets",
      },
      {
        id: "authority-terms",
        title: "Authority terms",
        href: "/docs/reference/authority-terms",
      },
      {
        id: "installation-states",
        title: "Installation states",
        href: "/docs/reference/installation-states",
      },
      {
        id: "deployment",
        title: "Deployment",
        href: "/docs/reference/deployment",
      },
      {
        id: "limitations",
        title: "Limitations",
        href: "/docs/reference/limitations",
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    items: [
      {
        id: "trust-model",
        title: "Trust model",
        href: "/docs/security/trust-model",
      },
      {
        id: "authorization-boundaries",
        title: "Authorization boundaries",
        href: "/docs/security/authorization-boundaries",
      },
      {
        id: "replay-protection",
        title: "Replay protection",
        href: "/docs/security/replay-protection",
      },
      { id: "recovery", title: "Recovery", href: "/docs/security/recovery" },
      {
        id: "public-demo-controls",
        title: "Public demo controls",
        href: "/docs/security/public-demo-controls",
      },
      { id: "privacy", title: "Privacy", href: "/docs/security/privacy" },
    ],
  },
  {
    id: "proof",
    title: "Proof",
    items: [
      {
        id: "live-deployment",
        title: "Live deployment",
        href: "/docs/proof/live-deployment",
      },
      {
        id: "verified-transactions",
        title: "Verified transactions",
        href: "/docs/proof/verified-transactions",
      },
      {
        id: "complete-run-example",
        title: "Complete run example",
        href: "/docs/proof/complete-run-example",
      },
    ],
  },
  {
    id: "help",
    title: "Help",
    items: [
      {
        id: "troubleshooting",
        title: "Troubleshooting",
        href: "/docs/help/troubleshooting",
      },
      { id: "faq", title: "FAQ", href: "/docs/help/faq" },
    ],
  },
];

export interface DocNavEntry {
  readonly groupId: string;
  readonly groupTitle: string;
  readonly item: DocNavItem;
}

export function flattenDocsNav(): DocNavEntry[] {
  return DOCS_NAV.flatMap((group) =>
    group.items.map((item) => ({
      groupId: group.id,
      groupTitle: group.title,
      item,
    })),
  );
}
