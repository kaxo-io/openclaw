import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withTempDir } from "../../test-utils/temp-dir.js";
import { __testing } from "./run.js";

describe("cron exact-command guard", () => {
  it("parses the literal exact command from a cron prompt", () => {
    expect(
      __testing.parseExactCommandFromPrompt(
        "[cron:r49 check] Run this exact command and report only the output: `cat HARD-RULES.md`",
      ),
    ).toBe("cat HARD-RULES.md");
  });

  it("rejects transcript command drift before delivery", async () => {
    await withTempDir("openclaw-exact-command-guard-", async (tmp) => {
      const transcriptPath = path.join(tmp, "session.jsonl");
      await fs.writeFile(
        transcriptPath,
        JSON.stringify({
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                name: "exec",
                arguments: { command: "find . -name HARD-RULES.md" },
              },
            ],
          },
        }) + "\n",
        "utf-8",
      );

      await expect(
        __testing.validateExactCommandDiscipline({
          expectedCommand: "cat HARD-RULES.md",
          transcriptPath,
        }),
      ).resolves.toMatch(/command mismatch/);
    });
  });

  it("accepts a transcript with exactly one matching shell command", async () => {
    await withTempDir("openclaw-exact-command-guard-", async (tmp) => {
      const transcriptPath = path.join(tmp, "session.jsonl");
      await fs.writeFile(
        transcriptPath,
        JSON.stringify({
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                name: "exec",
                arguments: { command: "cat HARD-RULES.md" },
              },
            ],
          },
        }) + "\n",
        "utf-8",
      );

      await expect(
        __testing.validateExactCommandDiscipline({
          expectedCommand: "cat HARD-RULES.md",
          transcriptPath,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
