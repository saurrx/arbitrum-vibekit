import { NextResponse } from 'next/server';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  computeWorkspaceVersion,
  validateBundleAgainstSchemas,
} from '@/lib/vfd/workspace';
import { stringifyMarkdown, stringifyJSON, resolveSkillPath } from '@/lib/vfd/serializers';
import type { VFDConfigSavePayload } from '@/lib/vfd/types';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(request: Request) {
  const configDir = process.env.VFD_CONFIG_DIR ?? 'config/vfd/';
  const payload: VFDConfigSavePayload = await request.json();

  const validationErrors = await validateBundleAgainstSchemas(payload);
  if (validationErrors.length > 0) {
    return NextResponse.json({ success: false, validationErrors }, { status: 400 });
  }

  const expectedVersion = payload.expectedWorkspaceVersion;
  const currentVersion = await computeWorkspaceVersion(configDir);
  if (expectedVersion !== currentVersion) {
    return NextResponse.json(
      { success: false, error: 'Config has changed since last load. Reload and retry.' },
      { status: 409 },
    );
  }

  try {
    const agentPath = join(configDir, 'agent.md');
    const agentMarkdown = stringifyMarkdown(payload.agent.frontmatter, payload.agent.body);
    await writeFile(agentPath, agentMarkdown, 'utf-8');

    const manifestPath = join(configDir, 'agent.manifest.json');
    const manifestJSON = stringifyJSON(payload.manifest);
    await writeFile(manifestPath, manifestJSON, 'utf-8');

    for (const skill of payload.skills) {
      const targetPath = resolveSkillPath(skill.path, configDir);
      const skillMarkdown = stringifyMarkdown(skill.frontmatter, skill.body);
      await writeFile(targetPath, skillMarkdown, 'utf-8');
    }

    const mcpPath = join(configDir, 'mcp.json');
    const mcpJSON = stringifyJSON(payload.mcp);
    await writeFile(mcpPath, mcpJSON, 'utf-8');

    const workflowPath = join(configDir, 'workflow.json');
    const workflowJSON = stringifyJSON(payload.workflow);
    await writeFile(workflowPath, workflowJSON, 'utf-8');

    const newVersion = await computeWorkspaceVersion(configDir);

    return NextResponse.json({ success: true, workspaceVersion: newVersion }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
