import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("sync requests use sender tab activity instead of only global focus lookup", async () => {
  const source = await readFile(
    new URL("../src/background.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /getShouldCountForSender/);
  assert.match(source, /onMessage\.addListener\(\(message,\s*sender,/);
  assert.match(source, /controller\.getSnapshot\(\{\s*shouldCount\s*\}\)/);
});
