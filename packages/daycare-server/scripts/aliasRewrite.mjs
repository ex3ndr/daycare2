import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

async function rewriteAliases(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  if (!content.includes("@/")) {
    return;
  }

  const relativeToRoot = path.relative(path.dirname(filePath), distDir);
  const base = relativeToRoot.length === 0 ? "." : relativeToRoot;
  const prefix = base === "." ? "./" : `${base}/`;

  const updated = content.replace(/(["'])@\//g, `$1${prefix}`);
  if (updated !== content) {
    await fs.writeFile(filePath, updated);
  }
}

async function main() {
  try {
    await fs.access(distDir);
  } catch {
    console.error(`dist directory not found at ${distDir}`);
    process.exit(1);
  }

  const files = await walk(distDir);
  const targets = files.filter((file) => file.endsWith(".js") || file.endsWith(".d.ts"));

  await Promise.all(targets.map((file) => rewriteAliases(file)));
}

await main();
