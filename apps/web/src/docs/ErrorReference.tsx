import type { DocBlock } from "./types.js";
import { CopyButton } from "./CopyButton.js";

export function ErrorReference({
  rows,
}: {
  rows: Extract<DocBlock, { t: "error" }>["rows"];
}) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table doc-error-table">
        <thead>
          <tr>
            <th scope="col">Code</th>
            <th scope="col">Status</th>
            <th scope="col">Why it happens</th>
            <th scope="col">What to do</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([code, status, why, fix]) => (
            <tr key={code}>
              <td>
                <code className="doc-inline-code">{code}</code>{" "}
                <CopyButton text={code} />
              </td>
              <td>{status}</td>
              <td>{why}</td>
              <td>{fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
