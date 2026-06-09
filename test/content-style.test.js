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

test("timer has clickable circular collapse button centered on top edge", async () => {
  const source = await readFile(new URL("../src/content.js", import.meta.url), "utf8");

  assert.match(source, /class="collapse"/);
  assert.match(source, /aria-label="Hide timer for one minute"/);
  assert.match(source, /\.collapse\s*\{[\s\S]*border-radius:\s*50%;/);
  assert.match(source, /\.collapse\s*\{[\s\S]*pointer-events:\s*auto;/);
  assert.match(source, /\.collapse\s*\{[\s\S]*left:\s*50%;/);
});

test("collapse state is memory-only so refresh shows panel again", async () => {
  const source = await readFile(new URL("../src/content.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /sessionStorage/);
  assert.match(source, /let collapsedUntilMs = 0;/);
});
