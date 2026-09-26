import type {
  CompanyRule,
  EvidenceResource,
  InstallationResource,
  InstallationStatus,
  StatusResource,
} from "./api.js";
import { KanonApiError } from "./api.js";

export interface DescribedError {
  readonly title: string;
  readonly detail: string;
  readonly recovery: string;
  readonly retryable: boolean;
}

export function isTransientError(error: unknown): boolean {
  if (error instanceof KanonApiError) {
    return (
      error.status === 408 ||
      error.status === 429 ||
      error.status >= 500 ||
      error.code === "UPSTREAM_TIMEOUT" ||
      error.code === "UPSTREAM_FAILED"
    );
  }
  if (error instanceof DOMException) {
    return error.name === "TimeoutError" || error.name === "AbortError";
  }
  // fetch() network failures surface as TypeError
  return error instanceof TypeError;
}

export function describeApiError(error: unknown): DescribedError {
  if (error instanceof KanonApiError) {
    switch (error.code) {
      case "DEMO_SESSION_ACTIVE": {
        const seconds = Number(error.details?.retryAfterSeconds ?? "60");
        const minutes = Math.max(1, Math.ceil(seconds / 60));
        return {
          title: "Another session is live",
          detail: `The shared demo fixture is in use by another run. It frees up in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
          recovery:
            "You can watch the latest run in read-only mode, or wait and try again.",
          retryable: true,
        };
      }
      case "RATE_LIMITED":
        return {
          title: "Rate limited",
          detail:
            "The hosted demo is rate limiting requests from this browser right now.",
          recovery: "Wait a minute, then retry the same action.",
          retryable: true,
        };
      case "DEMO_TERMS_OUT_OF_BOUNDS":
        return {
          title: "Terms outside the demo ceiling",
          detail:
            error.message ??
            "The hosted demo only allows the fixed recipient, ceilings up to 1000 wei, and a rolling window between 60 and 86400 seconds.",
          recovery: "Adjust the highlighted field and submit again.",
          retryable: false,
        };
      case "UPSTREAM_TIMEOUT":
        return {
          title: "The backend timed out",
          detail:
            "The request exceeded the proxy's limit. The server may still finish the work in the background.",
          recovery: "Check the run state — the result may already be recorded.",
          retryable: true,
        };
      case "UPSTREAM_FAILED":
        return {
          title: "A dependency could not be reached",
          detail:
            "The API could not reach the runner or a provider for this request.",
          recovery: "Wait a few seconds and retry.",
          retryable: true,
        };
      case "CONFLICT":
        return {
          title: "State conflict",
          detail:
            error.message ??
            "The installation changed while this request was in flight.",
          recovery: "Reload the run state and look at the current status.",
          retryable: true,
        };
      case "REVOKED":
        return {
          title: "Authority was revoked",
          detail:
            "This installation's delegated authority has been removed. Further actions fail closed.",
          recovery: "Start a new run to exercise the flow again.",
          retryable: false,
        };
      case "FORBIDDEN":
        return {
          title: "Not allowed",
          detail: "This route or action is not available to the demo role.",
          recovery: "Use the guided flow controls on this page.",
          retryable: false,
        };
      case "UNAUTHORIZED":
        return {
          title: "Not authorized",
          detail: "The request lacks the credential this action requires.",
          recovery: "Public runs do not need credentials; retry the action.",
          retryable: false,
        };
      case "NOT_FOUND":
        return {
          title: "Not found",
          detail:
            "This resource is not available on the deployed API. It may have been removed or never existed.",
          recovery: "Reload the workspace to fetch the current list.",
          retryable: false,
        };
      case "HUMAN_APPROVAL_REQUIRED":
        return {
          title: "Human review required",
          detail:
            "This change expands authority and cannot proceed without a fresh human decision.",
          recovery: "Review the change and approve or reject it explicitly.",
          retryable: false,
        };
      case "AUTHORITY_MISMATCH":
        return {
          title: "Authority mismatch",
          detail:
            "The requested action does not match the recorded authority boundary.",
          recovery: "Refresh and re-check the approved terms.",
          retryable: true,
        };
      case "UNSUPPORTED_POLICY_COMBINATION":
        return {
          title: "Unsupported authority term",
          detail:
            "A term cannot be enforced by the execution method, so no policy was created. The request failed closed.",
          recovery: "Remove the unsupported term and submit again.",
          retryable: false,
        };
      case "INTERNAL_ERROR":
        return {
          title: "Server error",
          detail: "The API returned an internal error.",
          recovery: "Retry; if it persists, check the API status badge.",
          retryable: true,
        };
      case "INVALID_REQUEST":
        return {
          title: "Invalid request",
          detail: error.message ?? "The request was rejected as malformed.",
          recovery: "Review the form fields and try again.",
          retryable: false,
        };
      default:
        return {
          title: "Request failed",
          detail: error.message || `The API returned ${error.code}.`,
          recovery: "Retry the action or reload the run state.",
          retryable: true,
        };
    }
  }
  if (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return {
      title: "Timed out",
      detail:
        "The request took too long in the browser. The server may still be working on it.",
      recovery: "The app will keep checking the result automatically.",
      retryable: true,
    };
  }
  if (error instanceof TypeError) {
    return {
      title: "Network error",
      detail: "The request could not reach the API at all.",
      recovery: "Check your connection, then retry.",
      retryable: true,
    };
  }
  return {
    title: "Something went wrong",
    detail:
      error instanceof Error ? error.message : "The request could not finish.",
    recovery: "Retry the action or reload the run state.",
    retryable: true,
  };
}

export type ScreenTarget =
  | "agents"
  | "add"
  | "authority"
  | "review"
  | "detail"
  | "update";

export interface NextStep {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly action?: {
    readonly label: string;
    readonly screen: ScreenTarget;
    readonly command?:
      | "execute-allowed"
      | "execute-forbidden"
      | "revoke"
      | "post-revoke"
      | "start-run";
  };
  readonly inProgress?: boolean;
}

function executions(
  installation: InstallationResource | undefined,
): readonly Record<string, unknown>[] {
  return (installation?.evidence ?? [])
    .filter(
      (entry: EvidenceResource) =>
        entry.schema === "kanon.api.execution-evidence",
    )
    .map((entry) => entry.evidence);
}

function hasExecutionOutcome(
  installation: InstallationResource | undefined,
  outcome: string,
): boolean {
  return executions(installation).some((entry) => entry.outcome === outcome);
}

export function postRevokeAttempted(
  installation: InstallationResource | undefined,
): boolean {
  if (installation?.revoke?.postRevokeExecutionFailed === true) return true;
  const evidence = installation?.evidence ?? [];
  const revokeIndex = evidence.findIndex(
    (entry) => entry.schema === "kanon.api.revocation-evidence",
  );
  if (revokeIndex < 0) return false;
  return evidence
    .slice(revokeIndex + 1)
    .some(
      (entry) =>
        entry.schema === "kanon.api.execution-evidence" &&
        entry.evidence.outcome === "REJECTED",
    );
}

const ACTIVE_LIKE: readonly InstallationStatus[] = [
  "ACTIVE",
  "UPDATE_AVAILABLE",
];

export function nextStepFor(input: {
  readonly installation?: InstallationResource;
  readonly installationSource: "session" | "observe" | "none";
  readonly liveSession?: StatusResource["demo"]["liveSession"];
  readonly connected: boolean;
}): NextStep {
  const { installation, liveSession, connected } = input;
  if (!connected) {
    return {
      key: "connecting",
      title: "Connect to the API",
      detail: "The workspace needs the hosted API before it can show a run.",
      inProgress: true,
    };
  }
  const ours =
    liveSession !== null &&
    liveSession !== undefined &&
    liveSession.installationId === installation?.id;
  if (liveSession && !ours) {
    const minutes = Math.max(1, Math.ceil(liveSession.expiresInSeconds / 60));
    return {
      key: "fixture-busy",
      title: "The shared fixture is in use",
      detail: `Another session is live and frees up in about ${minutes} minute${minutes === 1 ? "" : "s"}. You can watch its run read-only meanwhile.`,
      action: { label: "Watch the latest run", screen: "detail" },
    };
  }
  if (!installation) {
    return {
      key: "start",
      title: "Start a live authority run",
      detail:
        "Register a release, approve an exact authority, then watch Privy allow one action and reject another — about five minutes on Sepolia.",
      action: { label: "Start a run", screen: "add", command: "start-run" },
    };
  }
  const status = installation.status;
  if (status === "CONFIGURING_AUTHORITY") {
    return {
      key: "activating",
      title: "Activation in progress",
      detail:
        "Privy policy and delegated signer are being attached, then ENS records are written. Usually 30–60 seconds.",
      action: { label: "Watch activation", screen: "detail" },
      inProgress: true,
    };
  }
  if (status === "AWAITING_REAUTHORIZATION") {
    return {
      key: "reauthorizing",
      title: "Applying the new authority",
      detail:
        "The reauthorization was recorded. Privy is updated first, then the ENS record moves — usually under two minutes.",
      action: { label: "Watch progress", screen: "detail" },
      inProgress: true,
    };
  }
  if (status === "REVOKING") {
    return {
      key: "revoking",
      title: "Revocation in progress",
      detail:
        "The delegated signer is being removed, a post-revoke attempt is checked, then the ENS status is set to revoked.",
      action: { label: "Watch revocation", screen: "detail" },
      inProgress: true,
    };
  }
  if (status === "AWAITING_APPROVAL" || status === "VALIDATED") {
    return {
      key: "awaiting-approval",
      title: "Review and approve the exact authority",
      detail:
        "The release and company terms are recorded. A human decision binds them before any Privy authority exists.",
      action: { label: "Review and approve", screen: "review" },
    };
  }
  if (status === "UPDATE_AVAILABLE") {
    return {
      key: "update-available",
      title: "Review the broader release",
      detail:
        "A new release asks for a changed boundary. It cannot take effect until you approve or reject it.",
      action: { label: "Review the change", screen: "review" },
    };
  }
  if (status === "REVOKED") {
    if (!postRevokeAttempted(installation)) {
      return {
        key: "post-revoke",
        title: "Prove the revoked authority fails",
        detail:
          "One more attempt shows the runner refusing an action after revocation — the last piece of evidence.",
        action: {
          label: "Attempt the allowed action again",
          screen: "detail",
          command: "post-revoke",
        },
      };
    }
    return {
      key: "complete",
      title: "Run complete",
      detail:
        "Activation, allowed and forbidden actions, an expanded update, reauthorization, revocation and the post-revoke refusal are all on record.",
      action: { label: "View the proof summary", screen: "detail" },
    };
  }
  if (ACTIVE_LIKE.includes(status)) {
    if (!hasExecutionOutcome(installation, "SUCCEEDED")) {
      return {
        key: "allowed",
        title: "Run the allowed action",
        detail:
          "Send the 1 wei transaction the approved policy permits — evidence lands on Sepolia.",
        action: {
          label: "Run allowed action",
          screen: "detail",
          command: "execute-allowed",
        },
      };
    }
    if (!hasExecutionOutcome(installation, "REJECTED")) {
      return {
        key: "forbidden",
        title: "Try the forbidden action",
        detail:
          "The same shape of transaction to a different recipient must be rejected by the Privy policy, not by the UI.",
        action: {
          label: "Try forbidden action",
          screen: "detail",
          command: "execute-forbidden",
        },
      };
    }
    if (!installation.updateDiff && installation.generation === 0) {
      return {
        key: "update",
        title: "Request a broader release",
        detail:
          "Publish a release that asks for a higher ceiling and watch the diff classify it as EXPANDED.",
        action: { label: "Request a broader release", screen: "update" },
      };
    }
    if (installation.generation >= 1) {
      return {
        key: "revoke",
        title: "Revoke the authority",
        detail:
          "Remove the delegated signer, set the ENS status to revoked, then prove later actions fail.",
        action: {
          label: "Revoke authority",
          screen: "detail",
          command: "revoke",
        },
      };
    }
    return {
      key: "update",
      title: "Request a broader release",
      detail:
        "Publish a release that asks for a higher ceiling and watch the diff classify it as EXPANDED.",
      action: { label: "Request a broader release", screen: "update" },
    };
  }
  return {
    key: "inspect",
    title: "Inspect the run",
    detail: "Open the detail view to see the current authority state.",
    action: { label: "Open detail", screen: "detail" },
  };
}

export interface ActivationSubstep {
  readonly label: string;
  readonly done: boolean;
  readonly active: boolean;
}

// The terms form for a *new* run must start from the demo defaults, not from
// whatever run happens to be observed — an earlier session's already-updated
// terms would otherwise seed the draft and the update step would ask for the
// boundary already in force (the API correctly rejects that as NO_CHANGE).
export function seededDraftTerms(
  installationSource: "session" | "observe" | "none",
  installation: InstallationResource | undefined,
):
  | { readonly rules: readonly CompanyRule[]; readonly permissionHash?: string }
  | undefined {
  if (installationSource !== "session") return undefined;
  const rules = installation?.companyTerms?.companyTerms?.authority.rules;
  if (!rules?.length) return undefined;
  return {
    rules: [...rules],
    permissionHash: installation?.companyTerms.permissionHash,
  };
}

export function activationSubsteps(
  submitted: boolean,
  installation: InstallationResource | undefined,
): readonly ActivationSubstep[] {
  const status = installation?.status;
  const configuring =
    status === "CONFIGURING_AUTHORITY" ||
    status === "ACTIVE" ||
    status === "UPDATE_AVAILABLE";
  const active = status === "ACTIVE" || status === "UPDATE_AVAILABLE";
  const authorityAttached =
    active || installation?.activeAuthority !== undefined || configuring;
  return [
    {
      label: "Human approval recorded",
      done: submitted,
      active: submitted && !configuring,
    },
    {
      label: "Privy policy and delegated signer attached",
      done: authorityAttached,
      active: configuring && !active,
    },
    {
      label: "ENS identity records written",
      done: active,
      active: configuring && !active,
    },
    {
      label: "Authority active",
      done: active,
      active: false,
    },
  ];
}
