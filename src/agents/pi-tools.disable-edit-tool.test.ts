import { describe, expect, it } from "vitest";
import "./test-helpers/fast-coding-tools.js";
import { createOpenClawCodingTools } from "./pi-tools.js";

describe("createOpenClawCodingTools disableEditTool", () => {
  it("keeps edit tool enabled by default", () => {
    const tools = createOpenClawCodingTools();
    expect(tools.some((tool) => tool.name === "edit")).toBe(true);
  });

  it("removes edit tool when disableEditTool=true", () => {
    const tools = createOpenClawCodingTools({ disableEditTool: true });
    expect(tools.some((tool) => tool.name === "edit")).toBe(false);
    expect(tools.some((tool) => tool.name === "write")).toBe(true);
  });
});
