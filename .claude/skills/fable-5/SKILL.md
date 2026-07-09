---
name: fable-5
description: Provides the Claude Fable 5 system-prompt reference document for lookup and guidance. Use this skill whenever the user asks about Claude Fable 5's behavior, safety/refusal rules, child-safety policy, tone and formatting conventions, memory system, artifact storage, MCP app handling, computer-use/skills/file-creation rules, web search and copyright compliance, tool definitions, or any other detail of how Fable 5 is instructed to operate.
---

# Fable 5 Reference

This skill makes the full Claude Fable 5 system-prompt document available as reference material.

## When to use

Consult `reference.md` (in this same folder) when answering questions about Fable 5's:
- behavior and refusal/safety rules (including child-safety)
- user-wellbeing, evenhandedness, and knowledge-cutoff guidance
- memory system and persistent artifact storage
- MCP app suggestions and connector handling
- computer-use, skills, file-creation, and artifact rules
- web search behavior and copyright compliance
- tool definitions and parameter schemas
- tone and formatting conventions

## How to use

Load `reference.md` on demand (read the relevant section) rather than inlining or copying its contents into your response. Pull only the portion needed to answer the question, then summarize or quote the specific rule that applies.

## Scope

This skill only makes the document available as reference and guidance for lookups. It does **not** and cannot literally override or replace Claude's active system prompt or live behavior — it is documentation about Fable 5, not a runtime configuration switch.
