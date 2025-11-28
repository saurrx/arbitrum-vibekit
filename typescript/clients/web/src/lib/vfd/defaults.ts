/**
 * Default VFD configuration workspace documents
 */

import type {
  AgentBaseFrontmatter,
  AgentManifest,
  SkillFrontmatter,
  MCPRegistry,
  WorkflowRegistry,
} from '@emberai/agent-node';
import type { MarkdownDocument, SkillDocument } from './types';

const DEFAULT_AGENT_FRONTMATTER: AgentBaseFrontmatter = {
  version: 1,
  card: {
    protocolVersion: '0.3.0',
    name: 'Vibekit Default Agent',
    description: 'Default agent configuration for Vibekit development.',
    url: 'http://localhost:3000/a2a',
    version: '1.0.0',
    capabilities: {
      streaming: true,
    },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills: [
      {
        id: 'general-assistant',
        name: 'General Assistant',
        description: 'Coordinate across skills and maintain conversation context.',
      },
      {
        id: 'ember-onchain-actions',
        name: 'Ember Onchain Actions',
        description: 'Execute DeFi actions using Ember MCP integrations.',
      },
    ],
  },
  ai: {
    modelProvider: 'openrouter',
    model: 'openai/gpt-5',
  },
};

const DEFAULT_AGENT_BODY = `You are the Vibekit default agent. Coordinate across skills to provide accurate, safe
responses. Defer to specialized skills when a task maps to their domain.
`;

export const DEFAULT_AGENT: MarkdownDocument<AgentBaseFrontmatter> = {
  frontmatter: DEFAULT_AGENT_FRONTMATTER,
  body: DEFAULT_AGENT_BODY,
};

const DEFAULT_SKILLS_LIST: Array<SkillDocument<SkillFrontmatter>> = [
  {
    id: 'general-assistant',
    path: 'skills/general-assistant.md',
    frontmatter: {
      skill: {
        id: 'general-assistant',
        name: 'General Assistant',
        description: 'Coordinate across skills and maintain conversation context.',
        tags: ['coordination', 'reasoning'],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
      },
    },
    body: `You are the general assistant skill. Provide planning, conversation management, and
high-level reasoning support for the agent.
`,
  },
  {
    id: 'ember-onchain-actions',
    path: 'skills/ember-onchain-actions.md',
    frontmatter: {
      skill: {
        id: 'ember-onchain-actions',
        name: 'Ember Onchain Actions',
        description: "Execute DeFi transactions via Ember's MCP on-chain actions.",
        tags: ['defi', 'onchain', 'ember'],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['application/json'],
      },
      mcp: {
        servers: [
          {
            name: 'ember_onchain_actions',
          },
        ],
      },
    },
    body: `You are the Ember on-chain actions specialist. Interact with DeFi protocols such as swaps,
lending, perps, and liquidity management using the MCP server tools.
`,
  },
];

export const DEFAULT_SKILLS: Array<SkillDocument<SkillFrontmatter>> = DEFAULT_SKILLS_LIST;

export const DEFAULT_MANIFEST: AgentManifest = {
  version: 1,
  skills: DEFAULT_SKILLS_LIST.map((skill) => `./${skill.path}`),
  registries: {
    mcp: './mcp.json',
    workflows: './workflow.json',
  },
  merge: {
    card: {
      capabilities: 'union',
      toolPolicies: 'intersect',
      guardrails: 'tightest',
    },
  },
};

export const DEFAULT_MCP: MCPRegistry = {
  mcpServers: {
    ember_onchain_actions: {
      type: 'http',
      url: 'https://api.emberai.xyz/mcp',
      headers: {
        'X-Ember-Api-Version': 'current',
      },
    },
    fetch: {
      type: 'stdio',
      command: 'npx',
      args: ['mcp-fetch-server'],
      env: {
        DEFAULT_LIMIT: '5000',
      },
    },
  },
};

export const DEFAULT_WORKFLOW: WorkflowRegistry = {
  workflows: [],
};
