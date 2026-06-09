import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("glass timer fills at least 20 percent of viewport and scales digits", async () => {
  const source = await readFile(new URL("../src/content.js", import.meta.url), "utf8");

  assert.match(source, /min-height:\s*20vh;/);
  assert.match(source, /display:\s*flex;/);
  assert.match(source, /align-items:\s*center;/);
  assert.match(source, /justify-content:\s*center;/);
  assert.match(source, /font-size:\s*clamp\(64px,\s*12vh,\s*140px\);/);
});
