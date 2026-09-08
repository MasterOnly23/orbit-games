const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { launchGame } = require("../electron/platform/launch.cjs");
const {
  validateLaunchOptions,
} = require("../electron/platform/launch-options.cjs");
const { mergeGames } = require("../electron/library/model.cjs");

test("custom launch options preserve literal arguments and working directory without a shell", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-launch-"));
  const script = path.join(directory, "probe.cjs"),
    output = path.join(directory, "result.json");
  try {
    await fs.writeFile(
      script,
      "require('node:fs').writeFileSync(process.argv[2], JSON.stringify({cwd:process.cwd(), args:process.argv.slice(3)}))",
    );
    const args = [
      script,
      output,
      "a path with spaces",
      "& echo should-not-execute",
      "$(not-a-command)",
    ];
    await launchGame(
      {
        status: "installed",
        launch: { kind: "file", target: process.execPath },
        launchOptions: { args, workingDirectory: directory },
      },
      { openPath: () => assert.fail("must not lose custom options") },
    );
    let result;
    for (let i = 0; i < 100; i++) {
      try {
        result = JSON.parse(await fs.readFile(output, "utf8"));
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    }
    assert.ok(result, "probe must produce its result");
    assert.equal(result.cwd.toLowerCase(), directory.toLowerCase());
    assert.deepEqual(result.args, args.slice(2));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test("custom options reject invalid targets and unavailable working directories", async () => {
  const launch = { kind: "file", target: process.execPath };
  await assert.rejects(
    validateLaunchOptions(launch, {
      args: ["bad\u0000arg"],
      workingDirectory: "",
    }),
  );
  await assert.rejects(
    validateLaunchOptions(launch, { args: [], workingDirectory: "relative" }),
  );
  await assert.rejects(
    validateLaunchOptions(
      { kind: "uri", target: "steam://run/10" },
      { args: ["-test"], workingDirectory: "" },
    ),
  );
  await assert.rejects(
    validateLaunchOptions(launch, {
      args: Array(65).fill("x"),
      workingDirectory: "",
    }),
  );
});
test("rescanning retains two manual entries sharing a launcher with different options", () => {
  const common = {
    provider: "Otros",
    manual: true,
    launch: { kind: "file", target: process.execPath },
    sources: [process.execPath],
    status: "installed",
  };
  const first = {
    ...common,
    id: "one",
    name: "One",
    launchOptions: { args: ["one"], workingDirectory: "" },
  };
  const second = {
    ...common,
    id: "two",
    name: "Two",
    launchOptions: { args: ["two"], workingDirectory: "" },
  };
  const result = mergeGames([{ ...first, manual: false }], [first, second]);
  assert.equal(result.length, 2);
  assert.deepEqual(result.find((g) => g.id === "two").launchOptions.args, [
    "two",
  ]);
});
