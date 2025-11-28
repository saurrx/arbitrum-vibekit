# TypeScript Workspace

This workspace hosts Vibekit's TypeScript monorepo, including the core agent runtime, Ember API clients, web clients, templates, and testing utilities. See the repository root `README.md` for a full overview of packages and high-level documentation.

## VFD Setup

The VibeFlow Designer requires specific prerequisites. Run:

```bash
pnpm vfd:env-check
```

This will verify:
- Node.js version compliance
- pnpm package manager
- Agent Doctor CLI availability
- Config workspace structure

Override the Task Runner command:

```bash
VFD_TASK_RUNNER_CMD="<custom-command>" pnpm vfd:env-check
```

For detailed logs, check `.vibecode/<branch>/env-check.json`.
