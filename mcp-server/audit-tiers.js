// Reports tier coverage before the wiki is published through a restricted MCP endpoint.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAllPages } from "./lib/parseWiki.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wikiRoot = path.resolve(__dirname, process.env.WIKI_ROOT || "..");
const pages = parseAllPages(path.join(wikiRoot, "wiki", "pages"));
const counts = { 1: 0, 2: 0, 3: 0 };

for (const page of pages) counts[page.tier] += 1;

console.log(`Pages: ${pages.length}`);
console.log(`Tier 1: ${counts[1]}`);
console.log(`Tier 2: ${counts[2]}`);
console.log(`Tier 3: ${counts[3]}`);
for (const tier of [1, 2, 3]) {
  console.log(`\nTier ${tier} files:`);
  for (const page of pages.filter((page) => page.tier === tier)) {
    console.log(`- ${path.basename(page.filePath)}`);
  }
}

const missing = pages.filter(
  (page) => !/^tier:\s*[123]\s*$/m.test(fs.readFileSync(page.filePath, "utf8"))
);
console.log("\nPages using automatic type defaults:");
if (missing.length === 0) {
  console.log("(none)");
} else {
  for (const page of missing) console.log(`- ${page.slug}`);
}
