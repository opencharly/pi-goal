# pi-goal

![pi-goal](docs/assets/pi-goal-poster.png)

Persistent autonomous goals for [pi](https://github.com/badlogic/pi-mono).

`pi-goal` adds a `/goal` command and goal tools so Pi can keep working toward a long-running, thread-scoped objective until the goal is complete, paused, cleared, or token-budget-limited.

## Install

```bash
pi install npm:pi-goal
```

Or from git:

```bash
pi install git:github.com/Michaelliv/pi-goal
```

## Usage

```text
/goal improve benchmark coverage until the suite has strong evidence
/goal --tokens 50k finish the migration and verify tests
/goal
/goal status
/goal pause
/goal resume
/goal clear
/goal statusbar off
```

When a goal is active, the extension shows compact visible lifecycle markers like `Goal active` and `Goal continuing`; expand them with `ctrl+o` to inspect the objective and usage. The full continuation instructions ride along as the content of that custom message, so the model always has the objective and audit guidance in the transcript while the renderer keeps the visible UI compact.

The same Pi agent keeps running normal turns in the same session context until it calls `update_goal({ status: "complete" })`, the user pauses/clears it, or the token budget is reached. Reloading Pi pauses an active goal instead of silently resuming it; use `/goal resume` to continue.

## What it adds

- `pi-goal-writer` skill: draft and review strong `/goal` objectives with evidence-based success criteria
- `/goal [--tokens 50k] <objective>`: set or replace a goal
- `/goal` or `/goal status`: show the current goal
- `/goal pause`: stop autonomous continuation without deleting the goal
- `/goal resume`: reactivate a paused goal
- `/goal clear`: remove the goal
- `/goal statusbar on|off`: show or hide the footer status line
- `create_goal` tool: model can set or replace the current goal only when explicitly requested
- `get_goal` tool: read current goal state
- `update_goal` tool: model can only mark the goal `complete`
- `get_goal` and `update_goal` are only exposed to the model while a goal is `active`; paused, cleared, complete, and budget-limited goals hide them so unrelated sessions are not tempted to call them
- footer status: `Pursuing goal`, `Goal paused`, `Goal achieved`, or `Goal unmet`

## Flow

```text
/goal <objective>
  -> persist goal in the current Pi session
  -> show compact Goal marker and footer status
  -> deliver continuation instructions as the marker's message content
  -> trigger an agent turn
  -> account time/tokens on turn_end
  -> queue another continuation on agent_end while active
  -> while a background subagent run is in flight, withhold the continuation so
     the agent is never pestered into parallel work while waiting on results
  -> stop when update_goal marks complete, user pauses/clears, or budget is hit
```

## Continuation behavior

Each continuation is more than a bare "continue": it tells the agent to continue with its TODOs, follow the rules in the project's `AGENTS.md` (and `CLAUDE.md` where present), and read the relevant skills before acting — then re-injects the objective, budget, and completion audit.

While a background subagent run is in flight (observed via pi-subagents' shared extension event bus, `subagent:async-started` / `subagent:async-complete` / `subagent:process-terminal`), the continuation is withheld: the agent is waiting on results and a "continue" would pester it into parallel work. The continuation resumes normally once the pending runs complete and their results are processed. Runs are keyed by id, with a stale-entry safety valve so a lost completion event can never block continuation forever.

## Completion behavior

The model is instructed to audit completion against real evidence before calling `update_goal`, and full completion of every tracked TODO is mandatory: the continuation audit requires checking the `todo` tool list, and `update_goal` refuses `status: "complete"` while the last observed todo list still has open (`[pending]` or `[in_progress]`) items. The `update_goal` tool deliberately accepts only `status: "complete"`; pausing, resuming, clearing, and budget limiting are controlled by the user or extension runtime. The final turn is still accounted even when the model completes the goal mid-turn.

## State

Goal state is stored as Pi custom session entries with `customType: "pi-goal"`. It follows the active session branch, survives reloads, and does not require an external database.

## License

MIT
