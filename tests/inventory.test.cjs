const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { windowsInventory } = require("../electron/library/scanner.cjs");

test(
  "Windows inventory accepts an empty shortcut folder list on first launch",
  { skip: process.platform !== "win32" },
  async () => {
    const inventory = await windowsInventory(
      [],
      path.resolve("electron/platform/inventory.ps1"),
    );
    assert.deepEqual(inventory.shortcuts, []);
    assert.ok(Array.isArray(inventory.warnings));
    assert.ok(Array.isArray(inventory.drives));
  },
);
