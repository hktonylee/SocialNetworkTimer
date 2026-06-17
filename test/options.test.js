import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("options page renders one toggle per social site", async () => {
  const html = await readFile(new URL("../options.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../src/options.js", import.meta.url), "utf8");

  assert.match(html, /Social site settings/);
  assert.match(html, /<script type="module" src="src\/options\.js"><\/script>/);
  assert.match(script, /enabledSocialSites/);
  assert.match(script, /socialSites/);
  assert.match(script, /type = "checkbox"/);
});
