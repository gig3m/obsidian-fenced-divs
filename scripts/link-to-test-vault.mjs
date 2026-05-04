import { copyFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const target = "test-vault/.obsidian/plugins/fenced-divs";
mkdirSync(target, { recursive: true });

for (const f of ["main.js", "manifest.json", "styles.css"]) {
  if (!existsSync(f)) continue;
  copyFileSync(f, join(target, f));
}

console.log(`[link-to-test-vault] copied build output -> ${target}`);
