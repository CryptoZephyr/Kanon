import type { DocInline } from "./types.js";
import { renderInline } from "./render-inline.js";

export interface DeploymentServiceRow {
  readonly service: string;
  readonly runsOn: readonly DocInline[];
  readonly endpoint: readonly DocInline[];
  readonly notes: readonly DocInline[];
}

export function DeploymentReference({
  rows,
}: {
  rows: readonly DeploymentServiceRow[];
}) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table">
        <thead>
          <tr>
            <th scope="col">Service</th>
            <th scope="col">Runs on</th>
            <th scope="col">Endpoint</th>
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.service}>
              <td>{row.service}</td>
              <td>{renderInline(row.runsOn)}</td>
              <td>{renderInline(row.endpoint)}</td>
              <td>{renderInline(row.notes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
