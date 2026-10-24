import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { cfgToolsApprovalMode } from "@oh-my-pi/pi-coding-agent/tools/settings";
import { TempDir } from "@oh-my-pi/pi-utils";

describe("settings host default", () => {
	let tempDir: TempDir;
	beforeEach(() => {
		tempDir = TempDir.createSync("@pi-settings-host-default-");
	});
	afterEach(async () => {
		await tempDir.remove();
	});

	async function project(name: string, mode?: string): Promise<string> {
		const dir = tempDir.join(name);
		fs.mkdirSync(dir, { recursive: true });
		if (mode) await Bun.write(path.join(dir, ".omp", "config.yml"), `tools:\n  approvalMode: ${mode}\n`);
		return dir;
	}

	it("supplies the value while no layer configures it, without counting as configured", () => {
		const settings = Settings.isolated();
		expect(cfgToolsApprovalMode.get(settings)).toBe("yolo");
		cfgToolsApprovalMode.hostDefault(settings, "write");
		expect(cfgToolsApprovalMode.get(settings)).toBe("write");
		expect(cfgToolsApprovalMode.isConfigured(settings)).toBe(false);
		expect(cfgToolsApprovalMode.provenance(settings)).toBe("default");
	});

	it("loses to global, project, overlay and runtime layers and returns after a global unset", async () => {
		const agentDir = tempDir.join("agent");
		const cwd = await project("plain");
		const settings = await Settings.loadIsolated({ cwd, agentDir });
		cfgToolsApprovalMode.hostDefault(settings, "write");

		cfgToolsApprovalMode.set(settings, "always-ask");
		expect(cfgToolsApprovalMode.get(settings)).toBe("always-ask");
		cfgToolsApprovalMode.unset(settings);
		expect(cfgToolsApprovalMode.get(settings)).toBe("write");

		cfgToolsApprovalMode.override(settings, "yolo");
		expect(cfgToolsApprovalMode.get(settings)).toBe("yolo");
		cfgToolsApprovalMode.clearOverride(settings);
		expect(cfgToolsApprovalMode.get(settings)).toBe("write");

		const overlay = settings.overlay();
		expect(cfgToolsApprovalMode.get(overlay)).toBe("write");
		cfgToolsApprovalMode.override(overlay, "always-ask");
		expect(cfgToolsApprovalMode.get(overlay)).toBe("always-ask");
		expect(cfgToolsApprovalMode.get(settings)).toBe("write");

		const configured = await Settings.loadIsolated({ cwd: await project("proj", "always-ask"), agentDir });
		cfgToolsApprovalMode.hostDefault(configured, "write");
		expect(cfgToolsApprovalMode.get(configured)).toBe("always-ask");
		expect(cfgToolsApprovalMode.provenance(configured)).toBe("project");
	});

	it("notifies listeners when the effective value changes because of it", async () => {
		const settings = Settings.isolated();
		const child = settings.overlay();
		const seen: string[] = [];
		cfgToolsApprovalMode.listen(child, value => {
			seen.push(value);
		});
		cfgToolsApprovalMode.hostDefault(settings, "write");
		await Promise.resolve();
		expect(seen).toEqual(["write"]);
	});

	it("follows re-scoping: yields to a project that configures it, returns in one that does not", async () => {
		const agentDir = tempDir.join("agent");
		const plain = await project("plain");
		const strict = await project("strict", "always-ask");
		const settings = await Settings.loadIsolated({ cwd: plain, agentDir });
		cfgToolsApprovalMode.hostDefault(settings, "write");

		await settings.reloadForCwd(strict);
		expect(cfgToolsApprovalMode.get(settings)).toBe("always-ask");
		await settings.reloadForCwd(plain);
		expect(cfgToolsApprovalMode.get(settings)).toBe("write");
		expect(cfgToolsApprovalMode.isConfigured(settings)).toBe(false);

		await settings.reloadFromDisk();
		expect(cfgToolsApprovalMode.get(settings)).toBe("write");
	});

	it("survives cloneForCwd and is inherited by overlays of the clone", async () => {
		const agentDir = tempDir.join("agent");
		const settings = await Settings.loadIsolated({ cwd: await project("plain"), agentDir });
		cfgToolsApprovalMode.hostDefault(settings, "write");
		const clone = await settings.cloneForCwd(await project("other"));
		expect(cfgToolsApprovalMode.get(clone)).toBe("write");
		expect(cfgToolsApprovalMode.get(clone.overlay())).toBe("write");
		const strict = await settings.cloneForCwd(await project("strict", "always-ask"));
		expect(cfgToolsApprovalMode.get(strict)).toBe("always-ask");
	});
});
