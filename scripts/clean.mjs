import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const name of [".next", path.join("node_modules", ".cache")]) {
  const p = path.join(root, name);
  try {
    fs.rmSync(p, { recursive: true, force: true });
    console.log("[clean] removed", name);
  } catch {
    /* yoksa sorun değil */
  }
}
