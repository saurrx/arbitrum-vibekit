/**
 * VFD Configuration Workspace
 * Functions to load, validate, and manage the VFD config workspace
 */

import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import {
  AgentBaseFrontmatterSchema,
  AgentManifestSchema,
  SkillFrontmatterSchema,
  MCPRegistrySchema,
  WorkflowRegistrySchema,
} from '@emberai/agent-node';
import type { VFDConfigBundle, ValidationError } from './types';
import { z } from 'zod';

/**
 * Loads the complete configuration bundle from the workspace
 */
export async function loadConfigBundle(configDir: string): Promise<VFDConfigBundle> {
  const absoluteConfigDir = resolve(configDir);

  const [agentData, manifestData, skillsData, mcpData, workflowData] = await Promise.all([
    loadAgentMarkdown(absoluteConfigDir),
    loadManifest(absoluteConfigDir),
    loadSkills(absoluteConfigDir),
    loadMCP(absoluteConfigDir),
    loadWorkflow(absoluteConfigDir),
  ]);

  const workspaceVersion = await computeWorkspaceVersion(absoluteConfigDir);

  return {
    agent: agentData,
    manifest: manifestData,
    skills: skillsData,
    mcp: mcpData,
    workflow: workflowData,
    workspaceVersion,
  };
}

/**
 * Computes a deterministic hash of the workspace state
 */
export async function computeWorkspaceVersion(configDir: string): Promise<string> {
  const absoluteConfigDir = resolve(configDir);
  const hash = createHash('sha256');

  const files = [
    join(absoluteConfigDir, 'agent.md'),
    join(absoluteConfigDir, 'agent.manifest.json'),
    join(absoluteConfigDir, 'mcp.json'),
    join(absoluteConfigDir, 'workflow.json'),
  ];

  const skillsDir = join(absoluteConfigDir, 'skills');
  try {
    const skillFiles = await readdir(skillsDir);
    files.push(
      ...skillFiles
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => join(skillsDir, f)),
    );
  } catch {
    // Skills directory might not exist yet
  }

  for (const file of files.sort()) {
    try {
      const content = await readFile(file, 'utf-8');
      hash.update(`${relative(absoluteConfigDir, file)}:${content}`);
    } catch {
      // File might not exist yet, skip it
    }
  }

  return `sha256:${hash.digest('hex')}`;
}

/**
 * Validates all parts of the bundle against Zod schemas
 */
export async function validateBundleAgainstSchemas(
  bundle: VFDConfigBundle,
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  try {
    AgentBaseFrontmatterSchema.parse(bundle.agent.frontmatter);
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(
        ...error.errors.map((e) => ({
          path: `agent.frontmatter.${e.path.join('.')}`,
          message: e.message,
        })),
      );
    }
  }

  try {
    AgentManifestSchema.parse(bundle.manifest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(
        ...error.errors.map((e) => ({
          path: `manifest.${e.path.join('.')}`,
          message: e.message,
        })),
      );
    }
  }

  bundle.skills.forEach((skill, index) => {
    try {
      SkillFrontmatterSchema.parse(skill.frontmatter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(
          ...error.errors.map((e) => ({
            path: `skills[${index}].frontmatter.${e.path.join('.')}`,
            message: e.message,
          })),
        );
      }
    }
  });

  try {
    MCPRegistrySchema.parse(bundle.mcp);
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(
        ...error.errors.map((e) => ({
          path: `mcp.${e.path.join('.')}`,
          message: e.message,
        })),
      );
    }
  }

  try {
    WorkflowRegistrySchema.parse(bundle.workflow);
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(
        ...error.errors.map((e) => ({
          path: `workflow.${e.path.join('.')}`,
          message: e.message,
        })),
      );
    }
  }

  return errors;
}

/**
 * Loads agent.md and parses frontmatter
 */
async function loadAgentMarkdown(
  configDir: string,
): Promise<{ frontmatter: unknown; body: string }> {
  const agentPath = join(configDir, 'agent.md');
  const content = await readFile(agentPath, 'utf-8');
  const parsed = matter(content);

  return {
    frontmatter: parsed.data,
    body: parsed.content,
  };
}

/**
 * Loads agent.manifest.json
 */
async function loadManifest(configDir: string): Promise<unknown> {
  const manifestPath = join(configDir, 'agent.manifest.json');
  const content = await readFile(manifestPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Loads all skills from skills/ directory
 */
async function loadSkills(
  configDir: string,
): Promise<Array<{ id: string; path: string; frontmatter: unknown; body: string }>> {
  const skillsDir = join(configDir, 'skills');
  const skills: Array<{ id: string; path: string; frontmatter: unknown; body: string }> = [];

  try {
    const files = await readdir(skillsDir);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = join(skillsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const parsed = matter(content);
      const skillId = file.replace(/\.md$/, '');

      skills.push({
        id: skillId,
        path: `skills/${file}`,
        frontmatter: parsed.data,
        body: parsed.content,
      });
    }
  } catch (error) {
    // Skills directory might not exist yet
  }

  return skills;
}

/**
 * Loads mcp.json
 */
async function loadMCP(configDir: string): Promise<unknown> {
  const mcpPath = join(configDir, 'mcp.json');
  const content = await readFile(mcpPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Loads workflow.json
 */
async function loadWorkflow(configDir: string): Promise<unknown> {
  const workflowPath = join(configDir, 'workflow.json');
  const content = await readFile(workflowPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Ensures the config directory and subdirectories exist
 */
export async function ensureConfigDirectory(configDir: string): Promise<void> {
  const absoluteConfigDir = resolve(configDir);
  await mkdir(absoluteConfigDir, { recursive: true });
  await mkdir(join(absoluteConfigDir, 'skills'), { recursive: true });
}

/**
 * Checks if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
