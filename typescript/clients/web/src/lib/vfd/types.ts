/**
 * VFD Configuration Types
 * Data Transfer Objects for VFD persistence API
 */

export interface MarkdownDocument<TFrontmatter = Record<string, unknown>> {
  frontmatter: TFrontmatter;
  body: string;
}

export interface SkillDocument<TFrontmatter = Record<string, unknown>> extends MarkdownDocument<TFrontmatter> {
  id: string;
  path: string;
}

export interface VFDConfigDocuments {
  agent: MarkdownDocument;
  manifest: unknown;
  skills: SkillDocument[];
  mcp: unknown;
  workflow: unknown;
}

export interface VFDConfigBundle extends VFDConfigDocuments {
  workspaceVersion: string;
}

export interface VFDConfigSavePayload extends VFDConfigDocuments {
  expectedWorkspaceVersion: string;
}

export interface VFDConfigSaveResponse {
  success: boolean;
  workspaceVersion?: string;
  error?: string;
  validationErrors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
}
