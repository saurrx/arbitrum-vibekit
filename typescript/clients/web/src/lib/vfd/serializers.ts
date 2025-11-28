/**
 * VFD Configuration Serializers
 * Safe serialization functions for deterministic file output
 */

import matter from 'gray-matter';
import { resolve, join } from 'node:path';

/**
 * Stringifies markdown with YAML frontmatter using gray-matter
 * Ensures deterministic serialization with consistent formatting
 */
export function stringifyMarkdown(frontmatter: Record<string, unknown>, body: string): string {
  return matter.stringify(body, frontmatter);
}

/**
 * Stringifies JSON with consistent formatting
 */
export function stringifyJSON(obj: unknown, indent: number = 2): string {
  return JSON.stringify(obj, null, indent) + '\n';
}

/**
 * Resolves skill path safely, preventing path traversal attacks
 * Ensures the resolved path stays within the config directory
 * @param skillPath - Relative path to skill file (e.g., "skills/general-assistant.md")
 * @param configDir - Base config directory
 */
export function resolveSkillPath(skillPath: string, configDir: string): string {
  const normalizedConfigDir = resolve(configDir);
  const fullPath = join(normalizedConfigDir, skillPath);
  const resolvedPath = resolve(fullPath);

  if (!resolvedPath.startsWith(normalizedConfigDir)) {
    throw new Error(`Path traversal detected: ${skillPath}`);
  }

  return resolvedPath;
}
