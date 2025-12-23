/**
 * @module commands/context/parsers/components
 * @description React component file parser
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ComponentInfo } from "./types";

const MAX_IMPORTS = 10;
const MAX_HOOKS = 5;
const MAX_FIELDS = 10;
const BUILT_IN_HOOKS = ["useCallback", "useEffect", "useMemo", "useState", "useRef"];

/**
 * Extract relevant imports from content
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    const source = match[2] ?? "";
    if (source.includes("react") || source.includes("next")) continue;

    const items = match[1]?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
    imports.push(...items);
  }

  return imports.slice(0, MAX_IMPORTS);
}

/**
 * Extract custom hooks from content
 */
function extractHooks(content: string): string[] {
  const hookMatches = content.match(/use\w+/g) || [];
  const customHooks = hookMatches.filter((h) => !BUILT_IN_HOOKS.includes(h));
  return [...new Set(customHooks)].slice(0, MAX_HOOKS);
}

/**
 * Extract purpose from JSDoc comment
 */
function extractPurpose(content: string): string | undefined {
  const match = content.match(/\/\*\*\s*\n\s*\*\s*(.+)\n/);
  return match?.[1]?.trim();
}

/**
 * Extract @feature annotations
 */
function extractFeatures(content: string): string[] {
  const features: string[] = [];
  for (const fm of content.matchAll(/@feature\s+(.+)/g)) {
    if (fm[1]) features.push(fm[1].trim());
  }
  return features;
}

/**
 * Analyze a single component file
 */
function analyzeComponent(filePath: string): ComponentInfo | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const fileName = path.basename(filePath);
  const componentName = fileName.replace(/\.tsx?$/, "");
  const isClient = content.includes("'use client'") || content.includes('"use client"');

  const purpose = extractPurpose(content);
  const state = detectStateManagement(content);
  const fields = extractFormFields(content);
  const errorHandling = detectErrorHandling(content);
  const features = extractFeatures(content);

  const result: ComponentInfo = {
    name: componentName,
    file: fileName,
    type: isClient ? "client" : "server",
    imports: extractImports(content),
    hooks: extractHooks(content),
  };

  if (purpose) result.purpose = purpose;
  if (state) result.state = state;
  if (fields.length > 0) result.fields = fields.slice(0, MAX_FIELDS);
  if (errorHandling) result.errorHandling = errorHandling;
  if (features.length > 0) result.features = features;

  return result;
}

/**
 * Extract form fields from component content
 */
function extractFormFields(content: string): string[] {
  const fields: string[] = [];
  const fieldPatterns = [
    // JSX components with name/id
    /<Input[^>]*(?:name|id)=["'](\w+)["']/g,
    /<Select[^>]*(?:name|id)=["'](\w+)["']/g,
    /<DatePicker[^>]*(?:name|id)=["'](\w+)["']/g,
    /<Textarea[^>]*(?:name|id)=["'](\w+)["']/g,
    // HTML inputs with name
    /<input[^>]*name=["'](\w+)["']/g,
    /<select[^>]*name=["'](\w+)["']/g,
    /<textarea[^>]*name=["'](\w+)["']/g,
    // react-hook-form
    /register\(["'](\w+)["']\)/g,
    /Controller[^}]+name:\s*["'](\w+)["']/g,
    // shadcn/ui FormField
    /<FormField[^}]*name=["'](\w+)["']/g,
    /FormField\s+name=["'](\w+)["']/g,
    // useState with object
    /useState\(\{\s*(\w+):/g,
    // formData patterns
    /formData\.(\w+)/g,
  ];

  for (const pattern of fieldPatterns) {
    const matches = content.matchAll(pattern);
    for (const m of matches) {
      if (m[1] && !fields.includes(m[1]) && m[1].length > 1) {
        fields.push(m[1]);
      }
    }
  }

  // Also extract fields from useState object literal
  const useStateMatch = content.match(/useState\(\{([^}]+)\}\)/);
  if (useStateMatch?.[1]) {
    const stateObj = useStateMatch[1];
    const stateFields = stateObj.match(/(\w+)\s*:/g);
    if (stateFields) {
      for (const f of stateFields) {
        const fieldName = f.replace(/\s*:$/, "");
        if (fieldName && !fields.includes(fieldName) && fieldName.length > 1) {
          fields.push(fieldName);
        }
      }
    }
  }

  return fields;
}

/**
 * Detect state management pattern
 */
function detectStateManagement(content: string): string | undefined {
  if (content.includes("useForm") || content.includes("react-hook-form")) {
    return "react-hook-form";
  }
  if (content.includes("useState")) {
    return "useState";
  }
  if (content.includes("useReducer")) {
    return "useReducer";
  }
  if (content.includes("zustand") || content.includes("create(")) {
    return "zustand";
  }
  return undefined;
}

/**
 * Detect error handling patterns
 */
function detectErrorHandling(content: string): string | undefined {
  const errorPatterns: string[] = [];
  if (content.includes("try") && content.includes("catch"))
    errorPatterns.push("try-catch");
  if (content.includes("onError") || content.includes("error:"))
    errorPatterns.push("callback");
  if (content.includes("toast.error") || content.includes("showError"))
    errorPatterns.push("toast");
  if (content.includes("setError") || content.includes("formState.errors"))
    errorPatterns.push("form-errors");
  if (content.includes("ErrorBoundary")) errorPatterns.push("boundary");
  if (errorPatterns.length > 0) {
    return errorPatterns.join(", ");
  }
  return undefined;
}

/**
 * Check if file matches any pattern
 */
function matchesPatterns(fileName: string, patterns: string[]): boolean {
  const nameLower = fileName.toLowerCase();
  return patterns.some((p) => nameLower.includes(p.toLowerCase()));
}

/**
 * Parse React component files to extract metadata
 */
export function parseComponents(
  componentsDir: string,
  patterns: string[],
): ComponentInfo[] {
  const results: ComponentInfo[] = [];

  if (!fs.existsSync(componentsDir)) return results;

  function scanDir(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Recurse into non-hidden directories
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        scanDir(fullPath);
        continue;
      }

      // Skip non-tsx files
      if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;

      // Skip files not matching patterns
      if (!matchesPatterns(entry.name, patterns)) continue;

      const info = analyzeComponent(fullPath);
      if (info) results.push(info);
    }
  }

  scanDir(componentsDir);
  return results;
}
