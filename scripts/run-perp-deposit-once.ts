import { runAcpPerpDeposit } from "../src/lib/acpPerpDeposit";

const master = process.argv[2] ?? "";
const amount = process.argv[3] ?? "";

try {
  const result = runAcpPerpDeposit({ masterAddress: master, amountUsdc: amount });
  process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`);
  process.exit(1);
}
