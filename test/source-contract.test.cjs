const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const indexSource = readFileSync(join(__dirname, "../.pi/extensions/pi-goal/index.ts"), "utf8");
const readme = readFileSync(join(__dirname, "../README.md"), "utf8");

test("create_goal tool carries strong goal-writing contract", () => {
	assert.match(indexSource, /A goal must be a durable, evidence-checkable work contract/);
	for (const phrase of [
		"outcome, verification surface, constraints, boundaries, iteration policy, and blocked stop condition",
		"Do not infer goals from ordinary coding tasks or one-off prompts",
		"Use this objective shape when possible",
		"verified by <specific evidence>, while preserving <constraints>",
		"Prefer a self-contained objective that survives continuation turns and context compaction",
		"ask a clarifying question if missing success criteria or boundaries materially affect the contract",
	]) {
		assert.match(indexSource, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
	}
});

test("create_goal uses upsert semantics for explicitly requested goals", () => {
	assert.match(indexSource, /sets or replaces the current thread goal/);
	assert.match(indexSource, /When called, create_goal replaces any existing goal with the new objective/);
	assert.doesNotMatch(indexSource, /replaceExisting/);
	assert.doesNotMatch(indexSource, /This thread already has a goal/);
});

test("update_goal remains completion-only in schema and guidance", () => {
	assert.match(indexSource, /name: "update_goal"/);
	assert.match(indexSource, /enum: \["complete"\]/);
	assert.match(indexSource, /Do not use update_goal to pause, resume, abandon, or budget-limit a goal/);
});

test("README documents the model-set goal and completion accounting contracts", () => {
	assert.match(readme, /`create_goal` tool: model can set or replace the current goal only when explicitly requested/);
	assert.match(readme, /The final turn is still accounted even when the model completes the goal mid-turn/);
});

test("continuation prompt drives TODOs, AGENTS.md, and skills before acting", () => {
	assert.ok(indexSource.includes("Continue with your TODOs, follow the rules in the project's AGENTS.md"));
	assert.ok(indexSource.includes("and read the relevant skills before acting"));
});

test("agent_end withholds continuation while a background subagent is pending", () => {
	assert.ok(indexSource.includes('SUBAGENT_ASYNC_STARTED_EVENT = "subagent:async-started"'));
	assert.ok(indexSource.includes('SUBAGENT_ASYNC_COMPLETE_EVENT = "subagent:async-complete"'));
	assert.ok(indexSource.includes("pi.events?.on?.(SUBAGENT_ASYNC_STARTED_EVENT, markPendingSubagentLaunched)"));
	assert.ok(indexSource.includes("if (hasPendingSubagentWork()) return;"));
	const start = indexSource.indexOf('pi.on("agent_end"');
	assert.ok(start >= 0, "agent_end handler present");
	const end = indexSource.indexOf("\t});", start);
	assert.ok(end > start, "agent_end handler closes");
	const handler = indexSource.slice(start, end);
	assert.ok(handler.includes("ctx.hasPendingMessages()"), "pending-message guard kept");
	assert.ok(handler.includes("hasPendingSubagentWork()"), "subagent guard inside agent_end");
});

test("update_goal refuses completion while the tracked todo list has open items", () => {
	assert.ok(indexSource.includes("OPEN_TODO_STATUS_PATTERN"));
	assert.ok(indexSource.includes("pending|in_progress"));
	assert.ok(indexSource.includes("hasTodoObservation && lastTodoObservationHasOpen"));
	assert.ok(indexSource.includes("The goal cannot be declared reached while the tracked todo list still has open items"));
	assert.ok(indexSource.includes("Full completion of every tracked TODO is mandatory before the goal is reached"));
	assert.ok(indexSource.includes("TODO_TOOL_NAME"));
});

test("todo observations reset at session boundaries", () => {
	assert.ok(indexSource.includes("pendingSubagentRuns.clear();"));
	assert.ok(indexSource.includes("hasTodoObservation = false;"));
	assert.ok(indexSource.includes("lastTodoObservationHasOpen = false;"));
});
