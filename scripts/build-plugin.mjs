/**
 * Packages the WordPress plugin.
 *
 * The plugin is two files now — the PHP and the starter-content JSON — so it
 * ships as a folder-based plugin rather than a single file. WordPress requires
 * the zip to contain one directory named after the plugin.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const dir = "wordpress";
const name = "ilovedurban-headless-cms";
const staging = path.join(dir, name);
const zip = path.join(dir, `${name}.zip`);
const files = [`${name}.php`, "seed-content.json"];

rmSync(staging, { recursive: true, force: true });
rmSync(zip, { force: true });
mkdirSync(staging, { recursive: true });

for (const file of files) {
  const from = path.join(dir, file);
  statSync(from); // throws with a clear path if a file is missing
  copyFileSync(from, path.join(staging, file));
}

execFileSync("zip", ["-qr", `${name}.zip`, name], { cwd: dir });
rmSync(staging, { recursive: true, force: true });

const kb = Math.round(statSync(zip).size / 1024);
console.log(`[plugin] ${zip} — ${files.length} files, ${kb} KB`);
