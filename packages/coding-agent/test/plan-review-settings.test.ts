import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lookup } from "@oh-my-pi/pi-coding-agent/config/registry";
import { resetSettingsForTest, Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { createSettingsHost } from "@oh-my-pi/pi-coding-agent/config/settings-ui";
import { getSettingsForTab } from "@oh-my-pi/pi-tui/overlays/settings-defs";

beforeEach(async () => {
	resetSettingsForTest();
	await Settings.init({ inMemory: true });
});

afterEach(() => {
	resetSettingsForTest();
});

function read(id: string, settings: Settings): unknown {
	const setting = lookup(id);
	if (!setting) throw new Error(`setting ${id} is not registered`);
	return setting.get(settings);
}

describe("plan.review settings", () => {
	// The review runtime reads these; a wrong default would turn review on for every user
	// or point it at an agent / model list that does not exist.
	it("defaults to review off, the bundled plan-reviewer agent, and the advisor/slow/default candidates", () => {
		const settings = Settings.isolated();

		expect(read("plan.review.enabled", settings)).toBe(false);
		expect(read("plan.review.agent", settings)).toBe("plan-reviewer");
		expect(read("plan.review.models", settings)).toEqual(["@advisor", "@slow", "@default"]);
	});

	it("lets a config layer turn review on", () => {
		expect(read("plan.review.enabled", Settings.isolated({ "plan.review.enabled": true }))).toBe(true);
	});
});

describe("plan.review settings UI", () => {
	// Agent and model rows only make sense while review can actually run: plan mode on AND review on.
	it("shows the review toggle with plan mode, and agent/models only while review is enabled", () => {
		const defs = getSettingsForTab(createSettingsHost().entries, "tasks");
		const enabled = defs.find(def => def.path === "plan.review.enabled");
		const agent = defs.find(def => def.path === "plan.review.agent");
		const models = defs.find(def => def.path === "plan.review.models");
		if (!enabled?.condition || !agent?.condition || !models?.condition) {
			throw new Error("plan.review settings must be listed in the tasks tab with a visibility condition");
		}
		// The JSON editor is what makes an array setting editable in the panel at all.
		expect(models.type).toBe("text");

		// Fresh defaults: plan mode on, review off.
		expect(enabled.condition()).toBe(true);
		expect(agent.condition()).toBe(false);
		expect(models.condition()).toBe(false);

		lookup("plan.review.enabled")?.set(Settings.instance, true);
		expect(agent.condition()).toBe(true);
		expect(models.condition()).toBe(true);

		lookup("plan.enabled")?.set(Settings.instance, false);
		expect(enabled.condition()).toBe(false);
		expect(agent.condition()).toBe(false);
		expect(models.condition()).toBe(false);
	});
});
