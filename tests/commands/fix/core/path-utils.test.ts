/**
 * @module commands/fix/core/__tests__/path-utils.test
 * @description Tests for path validation utilities
 */

import { describe, it, expect } from "vitest";
import { validatePathWithinProject } from "../../../../src/commands/fix/core/path-utils";

describe("validatePathWithinProject", () => {
  const projectRoot = "/project/root";

  describe("valid paths", () => {
    it("accepts relative path within project", () => {
      const result = validatePathWithinProject(projectRoot, "src/index.ts");
      expect(result.valid).toBe(true);
      expect(result.resolved).toBe("/project/root/src/index.ts");
      expect(result.error).toBeUndefined();
    });

    it("accepts absolute path within project", () => {
      const result = validatePathWithinProject(
        projectRoot,
        "/project/root/src/index.ts",
      );
      expect(result.valid).toBe(true);
      expect(result.resolved).toBe("/project/root/src/index.ts");
      expect(result.error).toBeUndefined();
    });

    it("accepts nested relative path", () => {
      const result = validatePathWithinProject(
        projectRoot,
        "src/lib/utils/helpers.ts",
      );
      expect(result.valid).toBe(true);
      expect(result.resolved).toBe("/project/root/src/lib/utils/helpers.ts");
    });

    it("accepts current directory", () => {
      const result = validatePathWithinProject(projectRoot, ".");
      expect(result.valid).toBe(true);
      expect(result.resolved).toBe("/project/root");
    });

    it("accepts subdirectory reference", () => {
      const result = validatePathWithinProject(projectRoot, "./src");
      expect(result.valid).toBe(true);
      expect(result.resolved).toBe("/project/root/src");
    });
  });

  describe("invalid paths - path traversal", () => {
    it("rejects path traversal with ..", () => {
      const result = validatePathWithinProject(projectRoot, "../etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("escapes project root");
    });

    it("rejects path traversal from subdirectory", () => {
      const result = validatePathWithinProject(
        projectRoot,
        "src/../../etc/passwd",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("escapes project root");
    });

    it("rejects absolute path outside project", () => {
      const result = validatePathWithinProject(projectRoot, "/etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("escapes project root");
    });

    it("rejects path that resolves outside project", () => {
      const result = validatePathWithinProject(
        projectRoot,
        "src/../../../etc/passwd",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("escapes project root");
    });
  });

  describe("edge cases", () => {
    it("handles empty path", () => {
      const result = validatePathWithinProject(projectRoot, "");
      expect(result.valid).toBe(true);
      expect(result.resolved).toBe("/project/root");
    });

    it("handles path with multiple slashes", () => {
      const result = validatePathWithinProject(projectRoot, "src//lib///utils");
      expect(result.valid).toBe(true);
      expect(result.resolved).toBe("/project/root/src/lib/utils");
    });

    it("handles path with trailing slash", () => {
      const result = validatePathWithinProject(projectRoot, "src/");
      expect(result.valid).toBe(true);
      expect(result.resolved).toBe("/project/root/src");
    });
  });

  describe("path normalization", () => {
    it("normalizes . references", () => {
      const result = validatePathWithinProject(projectRoot, "src/./lib/./utils");
      expect(result.valid).toBe(true);
      expect(result.resolved).toBe("/project/root/src/lib/utils");
    });

    it("normalizes .. within project", () => {
      const result = validatePathWithinProject(
        projectRoot,
        "src/lib/../utils/helper.ts",
      );
      expect(result.valid).toBe(true);
      expect(result.resolved).toBe("/project/root/src/utils/helper.ts");
    });
  });
});
