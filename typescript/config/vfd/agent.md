---
version: 1
card:
  protocolVersion: '0.3.0'
  name: 'Vibekit Default Agent'
  description: 'Default agent configuration for Vibekit development.'
  url: 'http://localhost:3000/a2a'
  version: '1.0.0'
  capabilities:
    streaming: true
  defaultInputModes:
    - text/plain
    - application/json
  defaultOutputModes:
    - text/plain
    - application/json
  skills:
    - id: general-assistant
      name: General Assistant
      description: 'General purpose reasoning skill.'
    - id: ember-onchain-actions
      name: Ember Onchain Actions
      description: 'Interact with DeFi protocols via Ember on-chain actions.'
ai:
  modelProvider: openrouter
  model: openai/gpt-5
---

You are the Vibekit default agent. Coordinate across skills to provide accurate, safe
responses. Defer to specialized skills when a task maps to their domain.
