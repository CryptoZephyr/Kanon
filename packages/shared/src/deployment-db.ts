import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";
import type { AgentRelease } from "../../manifest/src/index.js";
import type { Installation } from "./index.js";

export type DeploymentProofStatus = "running" | "passed" | "failed";

export interface DeploymentDatabase {
  readonly pool: Pool;
  readonly migrate: () => Promise<void>;
  readonly close: () => Promise<void>;
  readonly getInstallation: (
    installationId: string,
  ) => Promise<Installation | undefined>;
  readonly findInstallationByAgent: (
    organizationId: string,
    agentId: string,
  ) => Promise<Installation | undefined>;
  readonly saveInstallation: (installation: Installation) => Promise<void>;
  readonly getRelease: (releaseId: string) => Promise<AgentRelease | undefined>;
  readonly findReleaseByAgent: (
    agentId: string,
  ) => Promise<AgentRelease | undefined>;
  readonly getReleaseForInstallation: (
    installationId: string,
  ) => Promise<AgentRelease | undefined>;
  readonly saveRelease: (
    release: AgentRelease,
    installationId: string,
  ) => Promise<void>;
  readonly getEvidence: (installationId: string) => Promise<readonly unknown[]>;
  readonly saveEvidence: (
    installationId: string,
    evidence: unknown,
  ) => Promise<void>;
  readonly saveProof: (
    runId: string,
    status: DeploymentProofStatus,
    proof: unknown,
  ) => Promise<void>;
  readonly getLatestProof: () => Promise<unknown | undefined>;
  readonly getProof: (runId: string) => Promise<unknown | undefined>;
}

function databaseUrlFromEnvironment(environment: NodeJS.ProcessEnv): string {
  const value = environment.DATABASE_URL;
  if (!value || value.trim() === "") {
    throw new Error("DATABASE_URL is required");
  }
  return value;
}

async function query<T extends QueryResultRow>(
  pool: Pool,
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, values);
  return result.rows;
}

export function createDeploymentDatabase(
  environment: NodeJS.ProcessEnv = process.env,
): DeploymentDatabase {
  const pool = new Pool({
    connectionString: databaseUrlFromEnvironment(environment),
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

  const migrate = async (): Promise<void> => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kanon_installations (
        installation_id TEXT PRIMARY KEY,
        state JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS kanon_proofs (
        run_id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed')),
        proof JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS kanon_proofs_updated_at_idx
        ON kanon_proofs (updated_at DESC);
      CREATE TABLE IF NOT EXISTS kanon_releases (
        release_id TEXT PRIMARY KEY,
        installation_id TEXT NOT NULL,
        release JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS kanon_releases_installation_idx
        ON kanon_releases (installation_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS kanon_installation_evidence (
        evidence_id UUID PRIMARY KEY,
        installation_id TEXT NOT NULL,
        evidence JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS kanon_installation_evidence_installation_idx
        ON kanon_installation_evidence (installation_id, created_at DESC);
    `);
  };

  return {
    pool,
    migrate,
    close: async () => {
      await pool.end();
    },
    getInstallation: async (installationId) => {
      const rows = await query<{ state: Installation }>(
        pool,
        "SELECT state FROM kanon_installations WHERE installation_id = $1",
        [installationId],
      );
      return rows[0]?.state;
    },
    findInstallationByAgent: async (organizationId, agentId) => {
      const rows = await query<{ state: Installation }>(
        pool,
        `
          SELECT state
          FROM kanon_installations
          WHERE state->>'organizationId' = $1
            AND state->'release'->>'agentId' = $2
            AND state->>'status' <> 'REVOKED'
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [organizationId, agentId],
      );
      return rows[0]?.state;
    },
    saveInstallation: async (installation) => {
      await pool.query(
        `
          INSERT INTO kanon_installations (installation_id, state, updated_at)
          VALUES ($1, $2::jsonb, NOW())
          ON CONFLICT (installation_id) DO UPDATE SET
            state = EXCLUDED.state,
            updated_at = NOW()
        `,
        [installation.id, JSON.stringify(installation)],
      );
    },
    getRelease: async (releaseId) => {
      const rows = await query<{ release: AgentRelease }>(
        pool,
        "SELECT release FROM kanon_releases WHERE release_id = $1",
        [releaseId],
      );
      return rows[0]?.release;
    },
    findReleaseByAgent: async (agentId) => {
      const rows = await query<{ release: AgentRelease }>(
        pool,
        `
          SELECT release
          FROM kanon_releases
          WHERE release->>'agentId' = $1
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [agentId],
      );
      return rows[0]?.release;
    },
    getReleaseForInstallation: async (installationId) => {
      const rows = await query<{ release: AgentRelease }>(
        pool,
        `
          SELECT release
          FROM kanon_releases
          WHERE installation_id = $1
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [installationId],
      );
      return rows[0]?.release;
    },
    saveRelease: async (release, installationId) => {
      await pool.query(
        `
          INSERT INTO kanon_releases (release_id, installation_id, release, updated_at)
          VALUES ($1, $2, $3::jsonb, NOW())
          ON CONFLICT (release_id) DO UPDATE SET
            installation_id = EXCLUDED.installation_id,
            release = EXCLUDED.release,
            updated_at = NOW()
        `,
        [release.releaseId, installationId, JSON.stringify(release)],
      );
    },
    getEvidence: async (installationId) => {
      const rows = await query<{ evidence: unknown }>(
        pool,
        `
          SELECT evidence
          FROM kanon_installation_evidence
          WHERE installation_id = $1
          ORDER BY created_at ASC
        `,
        [installationId],
      );
      return rows.map((row) => row.evidence);
    },
    saveEvidence: async (installationId, evidence) => {
      await pool.query(
        `
          INSERT INTO kanon_installation_evidence
            (evidence_id, installation_id, evidence)
          VALUES ($1, $2, $3::jsonb)
        `,
        [randomUUID(), installationId, JSON.stringify(evidence)],
      );
    },
    saveProof: async (runId, status, proof) => {
      await pool.query(
        `
          INSERT INTO kanon_proofs (run_id, status, proof, updated_at)
          VALUES ($1, $2, $3::jsonb, NOW())
          ON CONFLICT (run_id) DO UPDATE SET
            status = EXCLUDED.status,
            proof = EXCLUDED.proof,
            updated_at = NOW()
        `,
        [runId, status, JSON.stringify(proof)],
      );
    },
    getLatestProof: async () => {
      const rows = await query<{ proof: unknown }>(
        pool,
        "SELECT proof FROM kanon_proofs ORDER BY updated_at DESC LIMIT 1",
      );
      return rows[0]?.proof;
    },
    getProof: async (runId) => {
      const rows = await query<{ proof: unknown }>(
        pool,
        "SELECT proof FROM kanon_proofs WHERE run_id = $1",
        [runId],
      );
      return rows[0]?.proof;
    },
  };
}
