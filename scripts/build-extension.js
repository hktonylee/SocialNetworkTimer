import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));

if (packageJson.version !== manifest.version) {
  throw new Error(
    `package.json version ${packageJson.version} does not match manifest version ${manifest.version}`,
  );
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return files.flat().sort();
}

const archivePath = `dist/${packageJson.name}-${manifest.version}.zip`;
const extensionFiles = ["manifest.json", ...await listFiles("src")];

await mkdir("dist", { recursive: true });
await rm(archivePath, { force: true });

execFileSync("zip", ["-X", "-q", archivePath, ...extensionFiles], {
  stdio: "inherit",
});

console.log(`Built ${archivePath}`);
