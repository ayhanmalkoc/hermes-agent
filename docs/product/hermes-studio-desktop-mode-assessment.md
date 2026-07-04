# Hermes Studio Desktop Mode Assessment

## Verdict

Hermes Studio should be an experimental mode inside Hermes Desktop, not a second client and not a new backend. The PRD maps well to the existing Desktop + `tui_gateway` architecture if we treat Studio as a product shell around native Hermes sessions, approvals, providers, tools, artifacts, and background delegation.

## Architectural Reframe

Original PRD split:

```text
Hermes Agent = runtime / engine
Hermes Studio = product layer / orchestration UI
```

Desktop-mode version:

```text
Hermes Desktop = host app / native shell
Studio Mode = experimental route tree + cockpit UI
tui_gateway = existing runtime RPC surface
AIAgent / sessions / tools / approvals = unchanged execution core
```

Do not create:

- separate Electron app
- separate local backend
- duplicate session store
- duplicate approval engine
- duplicate artifact service
- new core model tools for Studio concepts

Create:

- `studio` mode flag / route namespace
- Studio-specific UI state and typed metadata
- thin gateway RPCs only where Desktop needs native data not already exposed
- optional persisted org/team/agent definitions in Hermes config/session DB/profile data

## Existing Hermes Surfaces To Reuse

| PRD Need | Existing Surface | Fit |
|---|---|---|
| Sessions | Desktop session store + `session.list` / `prompt.submit` | Strong |
| Live run stream | Existing message/tool/approval events | Strong |
| Approvals | `approval.request` / `approval.respond` | Strong |
| Artifacts | Desktop artifact extraction from session messages | Medium; needs stronger metadata later |
| Agents page | `apps/desktop/src/app/agents` already exists | Strong starting point |
| Provider/model override | Desktop model picker + gateway config/model state | Strong |
| Teams | New Studio metadata layer | Missing |
| Multi-team orchestration | Existing subagent/background delegation concepts, but needs productized routing | Medium |
| Outputs/works | Derived from sessions/artifacts initially | Medium |

## Recommended UX Shape

Studio Mode should replace the visible app shell while keeping the same backend connection.

```text
Left rail: Studio nav
  Chat / Cockpit
  Sessions
  Teams
  Agents
  Works
  Outputs
  Settings

Center: active product surface
  Cockpit chat first
  Entity tables/details for teams/agents/works/outputs

Right panel: Live Ops only
  run status
  tool calls
  approvals
  subagent activity
  logs/events
```

Key UX rule from PRD is correct: run starts from chat composer context, not a global form.

```text
[Team: Software] [Agent: QA] [Model: gpt-5.5] "test login flow"
→ creates normal Hermes session/run with Studio metadata attached
```

## Data Model: Minimal First Pass

Use a Studio domain model, but keep it as metadata over Hermes primitives.

```ts
interface StudioAgent {
  id: string
  name: string
  role: string
  provider?: string
  model?: string
  toolProfile?: string
  systemPrompt?: string
  teamIds: string[]
  enabled: boolean
}

interface StudioTeam {
  id: string
  name: string
  leadAgentId?: string
  memberAgentIds: string[]
  policy?: 'lead_routes' | 'parallel' | 'sequential'
}

interface StudioRunContext {
  sessionId: string
  teamIds: string[]
  agentIds: string[]
  modelOverride?: string
  mode: 'studio'
}
```

Persist initially in profile-scoped Desktop/Hermes config or a small Studio table if session DB extension is acceptable. Avoid mock-only state; PRD is right that relationships must be real.

## Execution Strategy

### Phase 1 — Desktop Shell Demo

- Add experimental Studio route/mode in Desktop.
- Reuse current gateway connection and session lifecycle.
- Build Studio nav, cockpit composer chips, teams/agents CRUD with local typed persistence.
- On send, submit to existing `prompt.submit` with Studio context encoded as metadata or preamble.
- Right panel subscribes to existing tool/approval/session events.

### Phase 2 — Native Gateway Integration

- Add small RPCs if needed:
  - `studio.catalog.get`
  - `studio.agent.save`
  - `studio.team.save`
  - `studio.run.start` only if plain `prompt.submit` metadata becomes too weak
- Keep these RPCs UI/product orchestration only; no new execution engine.
- Provider/model lists should come from existing model/config surfaces.

### Phase 3 — Real Team Orchestration

- Convert team selection into a Hermes-native orchestration prompt/session plan.
- Use existing subagent/delegation mechanisms where possible.
- Team lead routing should be policy metadata, not a new core tool.
- Runs remain Hermes sessions; Studio only adds org/team/agent attribution and views.

### Phase 4 — Outputs/Works

- Start with derived outputs from session messages/artifacts.
- Later add explicit artifact metadata when tools create files.
- Works page = grouped Studio runs/sessions by objective/project/team.

## Implementation Touchpoints

Likely files/modules:

- `apps/desktop/src/app/desktop-controller.tsx` — add route/mode entry and Studio shell mounting.
- `apps/desktop/src/app/routes.ts` — add route constants if centralized.
- `apps/desktop/src/app/agents/index.tsx` — evolve or wrap for Studio agents.
- `apps/desktop/src/app/artifacts/index.tsx` — reuse for Outputs, then strengthen metadata.
- `apps/desktop/src/store/*` — add Studio atoms for mode, teams, agents, run context.
- `apps/desktop/src/app/session/hooks/use-prompt-actions/*` — integrate composer context into submit flow.
- `tui_gateway/server.py` — add minimal Studio RPCs only after UI proves need.

## Main Risks

1. **Accidentally building a second backend** — avoid by routing all execution through existing gateway/session APIs.
2. **Fake cockpit state** — avoid by making agent/team/run relationships persisted from day one.
3. **Right panel scope creep** — keep it Live Ops only, not entity details.
4. **Prompt-cache breakage** — do not mutate core system prompts mid-conversation; attach Studio context at session start or as stable metadata/user context.
5. **Over-modeling agents** — start as role/model/tool/prompt presets over Hermes, not autonomous new runtime objects.
6. **Artifacts ambiguity** — current artifact extraction is text-derived; acceptable for demo, weak for production.

## Product Decision

Build Hermes Studio as `Experimental Studio Mode` in Hermes Desktop:

```text
Settings / flag → Studio Mode
Desktop shell switches to cockpit UI
Runtime remains Hermes gateway + AIAgent
Sessions remain Hermes sessions
Teams/agents are Studio metadata and presets
Runs are Hermes prompt submissions with Studio context
Live Ops uses existing events and approvals
```

This preserves Hermes architecture, avoids duplicate engine work, and turns the PRD into a realistic Desktop product layer.

