import { describe, expect, it } from "vitest";
import { apiUrl } from "./api";

describe("apiUrl", () => {
  it("appends the path to the API base URL", () => {
    expect(apiUrl("/api/runs")).toMatch(/\/api\/runs$/);
  });
});
