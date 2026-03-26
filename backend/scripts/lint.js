import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const ignoreDirs = new Set(["node_modules", ".git", "uploads"]);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
}

walk(projectRoot);

const failures = [];

for (const file of files) {
  try {
    const source = fs.readFileSync(file, "utf8");
    const normalized = source
      .replace(/^\s*import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?\s*$/gm, "")
      .replace(/^\s*import\s+["'][^"']+["'];?\s*$/gm, "")
      .replace(/^\s*export\s+default\s+/gm, "")
      .replace(/^\s*export\s+(const|function|class)\s+/gm, "$1 ")
      .replace(/import\.meta/g, "({ url: '' })");

    new Function(normalized);
  } catch (error) {
    failures.push(file);
    process.stderr.write(`${file}\n${error.message}\n`);
  }
}

if (failures.length > 0) {
  console.error(`Lint failed for ${failures.length} file(s).`);
  process.exit(1);
}

console.log(`Lint passed for ${files.length} file(s).`);
