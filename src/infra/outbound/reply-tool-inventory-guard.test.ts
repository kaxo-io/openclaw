import { beforeEach, describe, expect, it } from "vitest";
import {
  clearReplyToolInventoryEvidenceForTest,
  evaluateReplyToolInventoryGuard,
  recordReplyToolInventoryEvidence,
} from "./reply-tool-inventory-guard.js";

describe("reply tool inventory guard", () => {
  beforeEach(() => {
    clearReplyToolInventoryEvidenceForTest();
  });

  it("allows non-Telegram replies", () => {
    expect(
      evaluateReplyToolInventoryGuard({
        channelId: "slack",
        content: "Can you paste the export?",
        sessionKey: "agent:main:slack:C1",
      }),
    ).toEqual({ ok: true });
  });

  it("blocks Telegram replies that ask the user for data before tool evidence", () => {
    expect(
      evaluateReplyToolInventoryGuard({
        channelId: "telegram",
        content: "Can you paste the GSC export?",
        sessionKey: "agent:main:telegram:123",
      }),
    ).toEqual({
      ok: false,
      reason:
        "tool-inventory guard: Telegram reply asks the user for paste/access/check data before any same-turn tool query; inspect available tools first.",
    });
  });

  it("allows Telegram requests after a same-run query tool executes", () => {
    recordReplyToolInventoryEvidence({
      toolName: "functions.exec_command",
      runId: "run-1",
      sessionKey: "agent:main:telegram:123",
    });

    expect(
      evaluateReplyToolInventoryGuard({
        channelId: "telegram",
        content: "Can you paste the missing row?",
        runId: "run-1",
        sessionKey: "agent:main:telegram:123",
      }),
    ).toEqual({ ok: true });
  });

  it("does not count message-only tools as inventory evidence", () => {
    recordReplyToolInventoryEvidence({
      toolName: "message",
      runId: "run-1",
      sessionKey: "agent:main:telegram:123",
    });

    expect(
      evaluateReplyToolInventoryGuard({
        channelId: "telegram",
        content: "Do you have access to the Search Console account?",
        runId: "run-1",
        sessionKey: "agent:main:telegram:123",
      }).ok,
    ).toBe(false);
  });
});
