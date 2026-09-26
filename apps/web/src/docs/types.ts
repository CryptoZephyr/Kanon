export type DocInline =
  | string
  | { readonly code: string }
  | { readonly a: { readonly href: string; readonly label: string } };

export type DocBlock =
  | { readonly t: "p"; readonly text: readonly DocInline[] }
  | { readonly t: "h2"; readonly text: string; readonly id: string }
  | { readonly t: "h3"; readonly text: string; readonly id: string }
  | {
      readonly t: "code";
      readonly text: string;
      readonly label?: string;
      readonly copy?: boolean;
    }
  | {
      readonly t: "list";
      readonly ordered?: boolean;
      readonly items: readonly (readonly DocInline[])[];
    }
  | {
      readonly t: "callout";
      readonly kind: "note" | "warning" | "boundary";
      readonly title?: string;
      readonly text: readonly DocInline[];
    }
  | {
      readonly t: "table";
      readonly columns: readonly string[];
      readonly rows: readonly (readonly (readonly DocInline[])[])[];
    }
  | { readonly t: "flow"; readonly steps: readonly string[] }
  | {
      readonly t: "kv";
      readonly rows: readonly (readonly [string, readonly DocInline[]])[];
    }
  | {
      readonly t: "error";
      readonly rows: readonly (readonly [
        code: string,
        status: string,
        why: string,
        fix: string,
      ])[];
    };

export interface DocPageContent {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly blocks: readonly DocBlock[];
}

export interface DocSection {
  readonly id: string;
  readonly title: string;
  readonly pages: readonly DocPageContent[];
}
