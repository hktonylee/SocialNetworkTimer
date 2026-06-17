import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readManifest() {
  const source = await readFile(new URL("../manifest.json", import.meta.url), "utf8");
  return JSON.parse(source);
}

test("injects timer on Threads dot com pages", async () => {
  const manifest = await readManifest();
  const pattern = "*://*.threads.com/*";

  assert.ok(manifest.host_permissions.includes(pattern));
  assert.ok(manifest.content_scripts[0].matches.includes(pattern));
  assert.ok(manifest.web_accessible_resources[0].matches.includes(pattern));
});

test("uses icon png as extension icon", async () => {
  const manifest = await readManifest();

  assert.deepEqual(manifest.icons, {
    128: "icon.png",
  });
});

test("declares options page for site settings", async () => {
  const manifest = await readManifest();

  assert.equal(manifest.options_page, "options.html");
});
