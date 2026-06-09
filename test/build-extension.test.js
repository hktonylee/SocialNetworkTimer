import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";

test("build target creates Chrome Web Store publication zip", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(packageJson.scripts.build, "node scripts/build-extension.js");

  await rm("dist", { force: true, recursive: true });
  try {
    execFileSync("npm", ["run", "build"], { encoding: "utf8", stdio: "pipe" });

    const archivePath = "dist/social-network-timer-1.0.0.zip";
    const entries = execFileSync("unzip", ["-Z1", archivePath], {
      encoding: "utf8",
    }).trim().split("\n");

    assert.deepEqual(entries.toSorted(), [
      "manifest.json",
      "src/background-controller.js",
      "src/background.js",
      "src/content-view.js",
      "src/content.js",
      "src/timer.js",
    ]);
  } finally {
    await rm("dist", { force: true, recursive: true });
  }
});
