import { CopyButton } from "./CopyButton.js";

export function CodeBlock({
  text,
  label,
  copy,
}: {
  text: string;
  label?: string;
  copy?: boolean;
}) {
  return (
    <figure className="doc-codeblock">
      {label ? (
        <figcaption className="doc-codeblock-label">{label}</figcaption>
      ) : null}
      {copy ? <CopyButton text={text} /> : null}
      <pre>
        <code>{text}</code>
      </pre>
    </figure>
  );
}
