import { runPrivyFeasibilitySpike } from "../../../packages/privy/src/t3-runtime.js";

function safeMessage(error: unknown): string {
  const secrets = [
    process.env.PRIVY_APP_SECRET ?? "",
    process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY ?? "",
    process.env.PRIVY_OWNER_AUTHORIZATION_PRIVATE_KEY ?? "",
  ];
  let message =
    error instanceof Error ? error.message.slice(0, 240) : "UnknownError";
  for (const secret of secrets) {
    if (secret.length > 0) message = message.split(secret).join("[REDACTED]");
  }
  return message;
}

try {
  const evidence = await runPrivyFeasibilitySpike();
  if (evidence.status !== "passed") process.exitCode = 2;
} catch (error) {
  console.error("privy_t3=failed");
  console.error(`privy_t3_error=${safeMessage(error)}`);
  process.exitCode = 1;
}
