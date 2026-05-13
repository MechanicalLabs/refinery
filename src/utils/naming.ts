import { Err, Ok, type Result } from "ripthrow";

const NAME_REGEXP = /^[a-z0-9-]+$/u;

/**
 * Validates names against the kebab-case project standard.
 */
export function validateName(v: string): Result<void, string> {
  const trimmed = v.trim();
  if (!trimmed) {
    return Err("Name is required");
  }

  if (!NAME_REGEXP.test(trimmed)) {
    return Err("Only lowercase letters, numbers, and hyphens are allowed");
  }

  return Ok();
}

/**
 * Converts a string into a URL-friendly and identifier-friendly slug.
 */
export function slugify(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9-]/gu, "-")
    .replace(/-+/gu, "-") // Collapse consecutive hyphens
    .replace(/^-+|-+$/gu, ""); // Trim leading/trailing hyphens
}
