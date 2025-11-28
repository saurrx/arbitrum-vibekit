# Vibekit Frontend

A modern chat interface for interacting with AI agents built using Vibekit's Agent Node framework. This application enables seamless Agent-to-Agent (A2A) communication and workflow orchestration through an intuitive web interface.

> [!NOTE]
> This frontend is actively under development. New features and improvements are on the way!

## Features

- **Agent-to-Agent Communication**: Connect and communicate with multiple AI agents
- **Real-time Chat**: Instant messaging with immediate responses and updates
- **Agent Workflow Dispatch**: Trigger and monitor complex agent workflows

## Prerequisites

- Node.js 20.6 or higher
- pnpm 8.x or higher
- A running Agent Node instance (see [Agent Node documentation](../../lib/agent-node/README.md))

## Quick Start

### 1. Start an Agent Node Instance

First, initialize and start an agent using Agent Node. Run the following command in your desired project directory:

```bash
npx @emberai/agent-node@latest init
```

Then, configure the agent to run on port 3001 by setting the `PORT` variable in your `.env` file:

```
PORT=3001
```

Finally, start your agent:

```bash
npx -y @emberai/agent-node@latest
```

For more details on agent configuration and available options, see the [Agent Node documentation](../../lib/agent-node/README.md).

### 2. Install Dependencies and Start the Frontend

In a new terminal, navigate to the web directory and start the development server:

```bash
cd typescript/clients/web
pnpm install
pnpm dev
```

### 3. Interact with Your Agent

Navigate to [http://localhost:3000](http://localhost:3000) in your browser to start chatting with your agent.

## VFD Persistence API

The VFD Persistence API provides read/write access to the agent configuration workspace.

### GET /api/vfd/config/load

Loads the entire configuration workspace.

**Request:**
```bash
curl http://localhost:3000/api/vfd/config/load
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "agent": {"frontmatter": {"card": {"name": "..."}}, "body": "..."},
    "manifest": {"skills": ["./skills/general-assistant.md"]},
    "skills": [{"id": "general-assistant", "path": "skills/general-assistant.md"}],
    "mcp": {"mcpServers": {...}},
    "workflow": {"workflows": []},
    "workspaceVersion": "sha256:abc..."
  },
  "validationErrors": null
}
```

### POST /api/vfd/config/save

Saves the configuration workspace. Validates all schemas before persisting.

**Request:**
```bash
curl -X POST http://localhost:3000/api/vfd/config/save \
  -H "Content-Type: application/json" \
  -d '{
    "agent": {...},
    "manifest": {...},
    "skills": [...],
    "mcp": {...},
    "workflow": {...},
    "expectedWorkspaceVersion": "sha256:abc..."
  }'
```

**Response (200):**
```json
{
  "success": true,
  "workspaceVersion": "sha256:def..."
}
```

**Response (400) - Validation Error:**
```json
{
  "success": false,
  "validationErrors": [...]
}
```

### Environment Variables

- `VFD_CONFIG_DIR` — Path to the config workspace (defaults to `config/vfd/`)
