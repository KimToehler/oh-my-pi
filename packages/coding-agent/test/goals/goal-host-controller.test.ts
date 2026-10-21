import { describe, expect, test } from "bun:test";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { GoalHostController, type GoalHostSession } from "@oh-my-pi/pi-coding-agent/goals/host-controller";
import { GoalOwnerStale } from "@oh-my-pi/pi-coding-agent/goals/runtime";
import type { GoalModeState } from "@oh-my-pi/pi-coding-agent/goals/state";
import {
	isRpcSessionSettled,
	RpcSessionSettleWatcher,
	type RpcSettleSession,
	watchedScheduledTurnProbe,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-session-settle";
import type { AgentSessionEvent } from "@oh-my-pi/pi-coding-agent/session/agent-session";

function nextMacrotask(): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	setImmediate(resolve);
	return promise;
}

describe("GoalHostController continuation gate", () => {
	const agentEnd = { type: "agent_end", messages: [], isTerminal: true } as unknown as AgentSessionEvent;
	const hostInput = { type: "message_start", message: { role: "user", content: [] } } as unknown as AgentSessionEvent;

	function fakeSession(
		admit: (customType: string) => Promise<boolean>,
		options: { canAutoContinue?: () => boolean; onReconciled?: () => void | Promise<void> } = {},
	) {
		let goalState: GoalModeState | undefined = {
			enabled: true,
			mode: "active",
			goal: {
				id: "g1",
				objective: "o",
				status: "active",
				tokensUsed: 0,
				timeUsedSeconds: 0,
				createdAt: 0,
				updatedAt: 0,
			},
		};
		let idle = Promise.withResolvers<void>();
		idle.resolve();
		const journal: string[] = [];
		let tools: string[] = ["read"];
		let journaledGoal = false;
		let resumed = Promise.withResolvers<void>();
		resumed.resolve();
		let threadResumes = 0;
		const preservedActive: boolean[] = [];
		const transcript = { id: "t1" };
		let owner = true;
		const session = {
			settings: Settings.isolated({ "goal.continuationModes": ["rpc"] }),
			// Provider-facing id pinned by the host: must not be used to detect a session change.
			sessionId: "pinned-provider-id",
			sessionManager: {
				getSessionId: () => transcript.id,
				buildSessionContext: () =>
					journaledGoal
						? {
								mode: "goal_paused",
								modeData: {
									goal: {
										id: "j1",
										objective: "journaled",
										status: "paused",
										tokensUsed: 0,
										timeUsedSeconds: 0,
										createdAt: 0,
										updatedAt: 0,
									},
								},
							}
						: { mode: "none" },
				appendModeChange: (mode: string) => journal.push(`${transcript.id}:mode:${mode}`),
				appendCustomEntry: (type: string) => journal.push(`${transcript.id}:${type}`),
			},
			isDisposed: false,
			isSessionTransitioning: false,
			isStreaming: false,
			hasAdmittedSubmission: false,
			queuedMessageCount: 0,
			hasPendingAsyncWork: () => false,
			settleAsyncWork: async () => {},
			getPlanModeState: () => undefined,
			getGoalModeState: () => goalState,
			setGoalModeState: (state: GoalModeState | undefined) => {
				goalState = state;
			},
			getEnabledToolNames: () => [...tools],
			setActiveToolsByName: async (names: string[]) => {
				tools = [...names];
			},
			getTodoPhases: () => [],
			goalRuntime: {
				owns: () => owner,
				buildContinuationPrompt: () => "continue",
				clearAccounting: () => {},
				onThreadResumed: async (options?: { preserveActiveGoal?: boolean }) => {
					threadResumes++;
					preservedActive.push(options?.preserveActiveGoal === true);
					await resumed.promise;
					return goalState;
				},
				createGoal: async ({ objective }: { objective: string }): Promise<GoalModeState> => ({
					enabled: true,
					mode: "active",
					goal: {
						id: "g2",
						objective,
						status: "active",
						tokensUsed: 0,
						timeUsedSeconds: 0,
						createdAt: 0,
						updatedAt: 0,
					},
				}),
				resumeGoal: async (): Promise<GoalModeState> => {
					const resumedState: GoalModeState = {
						enabled: true,
						mode: "active",
						goal: { ...goalState!.goal, status: "active" },
					};
					goalState = resumedState;
					return resumedState;
				},
			},
			promptCustomMessage: (message: { customType: string }) => admit(message.customType),
			waitForIdle: () => idle.promise,
		};
		let dropped = 0;
		const controller = new GoalHostController(session as unknown as GoalHostSession, {
			continuationMode: "rpc",
			canAutoContinue: options.canAutoContinue,
			onContinuationDropped: () => dropped++,
			onReconciled: options.onReconciled,
		});
		return {
			session,
			controller,
			journal,
			transcript,
			goalState: () => goalState,
			tools: () => tools,
			threadResumes: () => threadResumes,
			/** `preserveActiveGoal` of each `onThreadResumed` call, in order. */
			preservedActive: () => preservedActive,
			/** Whether the stamp every entry carries still owns the transcript. */
			setOwner: (owns: boolean) => {
				owner = owns;
			},
			journalGoal: () => {
				journaledGoal = true;
			},
			holdResume: () => {
				resumed = Promise.withResolvers<void>();
			},
			releaseResume: () => resumed.resolve(),
			dropped: () => dropped,
			/** Hold waitForIdle until {@link release}. */
			hold: () => {
				idle = Promise.withResolvers<void>();
			},
			release: () => idle.resolve(),
		};
	}

	test("a continuation decided before the session closes is never admitted after it", async () => {
		const admitted: string[] = [];
		const { session, controller } = fakeSession(async customType => {
			admitted.push(customType);
			return true;
		});

		controller.observe(agentEnd);
		expect(controller.continuationPending).toBe(true);
		session.isDisposed = true;
		await nextMacrotask();
		expect(admitted).toEqual([]);
		expect(controller.continuationPending).toBe(false);

		// A host abort closes the gate before the aborted run's agent_end arrives.
		session.isDisposed = false;
		controller.stopForHostAbort();
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual([]);

		// Host input re-arms it; the next yield continues exactly once.
		controller.observe(hostInput);
		controller.observe(agentEnd);
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation"]);
	});

	test("a host abort of a continuation turn that ran a tool admits no further continuation", async () => {
		const admitted: string[] = [];
		const { controller } = fakeSession(async customType => {
			admitted.push(customType);
			return true;
		});
		const toolTurnEnd = {
			type: "agent_end",
			isTerminal: true,
			messages: [
				{ role: "assistant", content: [{ type: "toolCall", id: "t1", name: "read", arguments: { path: "a" } }] },
				{ role: "toolResult", toolName: "read", content: [{ type: "text", text: "x" }], isError: false },
			],
		} as unknown as AgentSessionEvent;

		// A yield admits continuation #1, so the next run is a continuation turn.
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation"]);

		// The host aborts that turn after it ran a tool (new activity); its agent_end follows.
		controller.stopForHostAbort();
		controller.observe(toolTurnEnd);
		await nextMacrotask();
		expect(controller.continuationPending).toBe(false);
		expect(admitted).toEqual(["goal-continuation"]);
	});

	test("a turn that was not a continuation re-arms after a no-progress stop, but never after a host abort", async () => {
		const admitted: string[] = [];
		const { controller } = fakeSession(async customType => {
			admitted.push(customType);
			return true;
		});
		// Continuation #1 makes no progress, so continuation stops.
		controller.observe(agentEnd);
		await nextMacrotask();
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation"]);
		expect(controller.continuationPending).toBe(false);

		// A turn nobody prompted (a delivery or job wake) ends: as in the TUI, the goal continues.
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation", "goal-continuation"]);

		// After a host abort, such a turn does not re-arm; only host input does.
		controller.stopForHostAbort();
		controller.observe(agentEnd);
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation", "goal-continuation"]);
		controller.observe(hostInput);
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation", "goal-continuation", "goal-continuation"]);
	});

	test("a rejected continuation does not claim the next run as its own", async () => {
		let calls = 0;
		const { controller } = fakeSession(async () => {
			calls++;
			if (calls === 1) throw new Error("Agent is busy");
			return true;
		});

		controller.observe(agentEnd);
		await nextMacrotask();
		await nextMacrotask();
		expect(calls).toBe(1);
		// Another source's run ends without tool activity. It is not a continuation turn,
		// so it must not count as "no progress" and stop the goal loop.
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(calls).toBe(2);
	});

	test("a continuation that finds the session busy or is refused releases settlement", async () => {
		let result = true;
		const admitted: string[] = [];
		const { session, controller, dropped } = fakeSession(async customType => {
			admitted.push(customType);
			return result;
		});

		// Another turn was admitted while the continuation waited: dropped, settle re-checked.
		session.hasAdmittedSubmission = true;
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual([]);
		expect(dropped()).toBe(1);

		// Mid-transition: dropped the same way.
		session.hasAdmittedSubmission = false;
		session.isSessionTransitioning = true;
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual([]);
		expect(dropped()).toBe(2);

		// Admitted but the session refuses to start it: no run follows, so settlement is released.
		session.isSessionTransitioning = false;
		result = false;
		controller.observe(agentEnd);
		await nextMacrotask();
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation"]);
		expect(dropped()).toBe(3);
		expect(controller.continuationPending).toBe(false);
	});

	test("a change that stays in the same session holds, then resumes the goal without settling in between", async () => {
		const admitted: string[] = [];
		const { controller, hold, release, dropped } = fakeSession(async customType => {
			admitted.push(customType);
			return true;
		});

		hold();
		controller.observe(agentEnd);
		await controller.beginSessionChange();
		// The change may be cancelled and the goal resumed: still reported as pending.
		expect(controller.continuationPending).toBe(true);
		release();
		await nextMacrotask();
		// A run that yields during the change (for example while a before-switch hook waits) is held too.
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual([]);
		const droppedDuringChange = dropped();

		// Same session afterwards (cancelled, or navigation within it): the goal resumes exactly once.
		await controller.endSessionChange();
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation"]);
		expect(controller.continuationPending).toBe(false);
		// Settlement is re-checked only once the change has ended.
		expect(dropped()).toBeGreaterThan(droppedDuringChange);
	});

	test("a transcript switch is detected even when the host pins the provider session id", async () => {
		const admitted: string[] = [];
		const { controller, transcript, goalState } = fakeSession(async customType => {
			admitted.push(customType);
			return true;
		});
		await controller.beginSessionChange();
		transcript.id = "t2";
		await controller.endSessionChange();
		await nextMacrotask();
		// The old goal is left behind, and nothing continues it in the new transcript.
		expect(goalState()).toBeUndefined();
		expect(admitted).toEqual([]);
	});

	test("a goal completed while a switch is pending is journaled in its own session", async () => {
		const { session, controller, transcript, journal } = fakeSession(async () => true);
		await controller.beginSessionChange();
		// The goal tool completes the goal while a before-switch hook is still pending; the records
		// are journaled synchronously at that yield, before the switch can commit.
		const current = session.getGoalModeState();
		session.setGoalModeState(current && { ...current, enabled: false, mode: "exiting", reason: "completed" });
		controller.observe(agentEnd);
		// The switch commits before any queued exit work could run.
		transcript.id = "t2";
		await controller.settled();
		await controller.endSessionChange();
		expect(journal).toEqual(["t1:mode:none", "t1:goal-completed"]);
	});

	test("a session change with no goal turn to hold does not withhold settlement", async () => {
		const { session, controller } = fakeSession(async () => true);
		session.setGoalModeState(undefined);
		await controller.beginSessionChange();
		expect(controller.continuationPending).toBe(false);
		await controller.endSessionChange();
	});

	test("a goal created while a session change is in progress is held, not reported settled", async () => {
		const admitted: string[] = [];
		const { session, controller } = fakeSession(async customType => {
			admitted.push(customType);
			return true;
		});
		session.setGoalModeState(undefined);
		await controller.beginSessionChange();
		expect(controller.continuationPending).toBe(false);
		await controller.handle({ op: "create", objective: "during the change" });
		expect(controller.continuationPending).toBe(true);
		await nextMacrotask();
		expect(admitted).toEqual([]);
		await controller.endSessionChange();
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation"]);
	});

	test("a pending goal turn reported during a change is always closed by session_settled", async () => {
		const frames: string[] = [];
		const { session, controller, transcript } = fakeSession(async () => true);
		session.setGoalModeState(undefined);
		// Same wiring as rpc-mode: the probe marks the watcher active whenever it reports pending.
		// The same probe rpc-mode wires: every "pending" answer marks the watcher active.
		const ref: { watcher?: RpcSessionSettleWatcher } = {};
		const probe = watchedScheduledTurnProbe(
			() => controller.continuationPending,
			() => ref.watcher,
		);
		const watcher = new RpcSessionSettleWatcher(
			session as unknown as ConstructorParameters<typeof RpcSessionSettleWatcher>[0],
			frame => frames.push(frame.type),
			probe,
		);
		ref.watcher = watcher;
		await controller.beginSessionChange();
		await controller.handle({ op: "create", objective: "held during the change" });
		expect(isRpcSessionSettled(session as unknown as RpcSettleSession, probe)).toBe(false);
		// The change switches away, so the held turn is abandoned and nothing will run.
		transcript.id = "t2";
		await controller.endSessionChange();
		await watcher.check();
		expect(isRpcSessionSettled(session as unknown as RpcSettleSession, probe)).toBe(true);
		expect(frames).toEqual(["session_settled"]);
	});

	test("a change that overlaps a running reconcile reconciles after it, never alongside it", async () => {
		const f = fakeSession(async () => true);
		f.session.setGoalModeState(undefined);
		f.journalGoal();
		// Change A switches t1 -> t2; its reconcile stalls inside onThreadResumed.
		f.holdResume();
		await f.controller.beginSessionChange();
		f.transcript.id = "t2";
		const endA = f.controller.endSessionChange();
		await nextMacrotask();
		expect(f.threadResumes()).toBe(1);
		// Change B begins and ends in the same transcript while A is still running.
		await f.controller.beginSessionChange();
		const endB = f.controller.endSessionChange();
		await nextMacrotask();
		// B queued a reconcile behind A instead of running one concurrently.
		expect(f.threadResumes()).toBe(1);
		f.releaseResume();
		await endA;
		await endB;
		await f.controller.settled();
		for (let i = 0; i < 5; i++) await nextMacrotask();
		expect(f.threadResumes()).toBe(2);
		// The pre-goal tool set was captured without the goal tool.
		expect(f.tools()).toEqual(["read", "goal"]);
		// When the goal later completes, exactly the pre-goal tools come back.
		const current = f.session.getGoalModeState();
		f.session.setGoalModeState(current && { ...current, enabled: false, mode: "exiting", reason: "completed" });
		f.controller.observe(agentEnd);
		await f.controller.settled();
		expect(f.tools()).toEqual(["read"]);
	});

	test("onReconciled fires after a reconcile queued behind a running one, with the final state in place", async () => {
		const observed: Array<{ transcript: string; goal: string | undefined; resumes: number }> = [];
		const holder: { f?: ReturnType<typeof fakeSession> } = {};
		const f = fakeSession(async () => true, {
			onReconciled: () => {
				observed.push({
					transcript: holder.f!.transcript.id,
					goal: holder.f!.goalState()?.goal.objective,
					resumes: holder.f!.threadResumes(),
				});
			},
		});
		holder.f = f;
		f.session.setGoalModeState(undefined);
		f.journalGoal();
		f.holdResume();
		await f.controller.beginSessionChange();
		f.transcript.id = "t2";
		const endA = f.controller.endSessionChange();
		await nextMacrotask();
		expect(f.threadResumes()).toBe(1);
		// Change B moves to a transcript with no goal while A's reconcile is still running.
		await f.controller.beginSessionChange();
		f.transcript.id = "t3";
		await f.controller.endSessionChange();
		await nextMacrotask();
		expect(observed).toEqual([]);
		f.releaseResume();
		await endA;
		await f.controller.settled();
		for (let i = 0; i < 5; i++) await nextMacrotask();
		// One call per reconcile; the last one ran after the queued reconcile.
		expect(observed.length).toBe(2);
		expect(observed.at(-1)?.transcript).toBe("t3");
		expect(observed.at(-1)?.resumes).toBe(2);
	});

	test("settled() waits for a reattach queued behind a running one", async () => {
		const f = fakeSession(async () => true);
		f.session.setGoalModeState(undefined);
		f.journalGoal();
		f.holdResume();
		// An extension change's reconcile is running (stalled in onThreadResumed).
		await f.controller.beginSessionChange();
		f.transcript.id = "t2";
		const endExtension = f.controller.endSessionChange();
		await nextMacrotask();
		// A host command's change ends meanwhile: its reattach is queued, not awaited.
		await f.controller.beginSessionChange();
		f.transcript.id = "t3";
		await f.controller.endSessionChange();
		let settled = false;
		const done = f.controller.settled().then(() => {
			settled = true;
		});
		await nextMacrotask();
		expect(settled).toBe(false);
		f.releaseResume();
		await endExtension;
		await done;
		expect(f.threadResumes()).toBe(2);
	});

	test("the startup reattach lets the runtime pause an active goal; an in-process change preserves it", async () => {
		const f = fakeSession(async () => true);
		f.journalGoal();
		await f.controller.reconcile();
		await f.controller.beginSessionChange();
		f.transcript.id = "t2";
		await f.controller.endSessionChange();
		await f.controller.settled();
		expect(f.preservedActive()).toEqual([false, true]);
	});

	test("a change that detached a continuation turn does not count the next turn as a continuation", async () => {
		const admitted: string[] = [];
		const { controller } = fakeSession(async customType => {
			admitted.push(customType);
			return true;
		});
		// A yield admits continuation #1.
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation"]);

		// A reload reopens the same transcript and detaches that turn: its terminal agent_end never comes.
		await controller.beginSessionChange();
		await controller.endSessionChange({ detachedRun: true });
		await nextMacrotask();
		// The goal resumes with continuation #2, which makes no progress, so continuation stops.
		expect(admitted).toEqual(["goal-continuation", "goal-continuation"]);
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toHaveLength(2);

		// A turn nobody prompted ends. It is not a continuation (#1 was detached), so as after
		// any no-progress stop the goal continues.
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation", "goal-continuation", "goal-continuation"]);
	});

	test("a goal created for a host prompt waits for that prompt's own turn before continuing", async () => {
		const admitted: string[] = [];
		const { session, controller } = fakeSession(async customType => {
			admitted.push(customType);
			return true;
		});
		session.setGoalModeState(undefined);

		await controller.createForHostPrompt({ objective: "objective from the host prompt" });
		await nextMacrotask();
		// The host is about to submit the objective prompt itself: nothing may race ahead of it.
		expect(admitted).toEqual([]);
		expect(controller.continuationPending).toBe(false);
		expect(session.getGoalModeState()?.goal.objective).toBe("objective from the host prompt");

		// That prompt's terminal agent_end decides the first continuation.
		controller.observe(hostInput);
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation"]);
	});

	test("a paused goal resumed for a host prompt waits for that prompt's own turn", async () => {
		const admitted: string[] = [];
		const { session, controller } = fakeSession(async customType => {
			admitted.push(customType);
			return true;
		});
		const current = session.getGoalModeState();
		session.setGoalModeState(current && { ...current, enabled: false, goal: { ...current.goal, status: "paused" } });

		await controller.resumeForHostPrompt();
		await nextMacrotask();
		expect(admitted).toEqual([]);
		expect(session.getGoalModeState()?.goal.status).toBe("active");

		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation"]);
	});

	describe("an entry abandoned by its stamp", () => {
		/** Transcript A's stamped entry is held in its tool swap while the host switches to transcript B and reconciles. */
		async function abandonedEntry(options: { goalInB: boolean; bTools?: string[]; swapApplied?: boolean }) {
			const f = fakeSession(async () => true);
			f.session.setGoalModeState(undefined);
			const swap = f.session.setActiveToolsByName;
			const entered = Promise.withResolvers<void>();
			const release = Promise.withResolvers<void>();
			f.session.setActiveToolsByName = async names => {
				f.session.setActiveToolsByName = swap;
				// The swap may already have installed its target when the owner's reconcile reads the tools.
				if (options.swapApplied) await swap(names);
				entered.resolve();
				await release.promise;
				await swap(names);
			};
			const entry = f.controller.createForHostPrompt({ objective: "A" }, { stamp: {} }).then(
				() => undefined,
				(error: unknown) => error,
			);
			await entered.promise;

			// Transcript B has a different tool selection and, optionally, a goal.
			f.setOwner(false);
			await f.controller.beginSessionChange();
			f.transcript.id = "t2";
			if (options.bTools) await swap(options.bTools);
			else if (!options.swapApplied) await swap(["read", "write"]);
			if (options.goalInB) f.journalGoal();
			await f.controller.endSessionChange({ detachedRun: true });
			release.resolve();
			const error = await entry;
			await f.controller.settled();
			return { f, error };
		}

		test("with a goal in B, B's tools are restored with goal and B's snapshot survives for the goal exit", async () => {
			const { f, error } = await abandonedEntry({ goalInB: true });
			expect(error).toBeInstanceOf(GoalOwnerStale);
			expect(f.session.getGoalModeState()?.goal.id).toBe("j1");
			expect(f.tools()).toEqual(["read", "write", "goal"]);

			// B's goal completes: exactly B's pre-goal tools come back, not A's.
			const current = f.session.getGoalModeState();
			f.session.setGoalModeState(current && { ...current, enabled: false, mode: "exiting", reason: "completed" });
			f.controller.observe(agentEnd);
			await f.controller.settled();
			expect(f.tools()).toEqual(["read", "write"]);
		});

		test("without a goal in B, B's own tools are restored and A's are not installed", async () => {
			const { f, error } = await abandonedEntry({ goalInB: false });
			expect(error).toBeInstanceOf(GoalOwnerStale);
			expect(f.session.getGoalModeState()).toBeUndefined();
			expect(f.tools()).toEqual(["read", "write"]);
		});

		test("an entry's own goal tool, already installed when B's reconcile reads the tools, is not taken for B's selection", async () => {
			const { f, error } = await abandonedEntry({ goalInB: true, swapApplied: true });
			expect(error).toBeInstanceOf(GoalOwnerStale);
			expect(f.session.getGoalModeState()?.goal.id).toBe("j1");

			// B's goal completes: B's pre-goal tools are what the entry replaced, without `goal`.
			const current = f.session.getGoalModeState();
			f.session.setGoalModeState(current && { ...current, enabled: false, mode: "exiting", reason: "completed" });
			f.controller.observe(agentEnd);
			await f.controller.settled();
			expect(f.tools()).toEqual(["read"]);
		});

		test("a goal tool B selected itself survives recovery and the later goal exit", async () => {
			const { f, error } = await abandonedEntry({ goalInB: true, bTools: ["read", "write", "goal"] });
			expect(error).toBeInstanceOf(GoalOwnerStale);
			expect(f.tools().toSorted()).toEqual(["goal", "read", "write"]);

			// B's goal completes: B's own `goal` selection is exactly what comes back.
			const current = f.session.getGoalModeState();
			f.session.setGoalModeState(current && { ...current, enabled: false, mode: "exiting", reason: "completed" });
			f.controller.observe(agentEnd);
			await f.controller.settled();
			expect(f.tools().toSorted()).toEqual(["goal", "read", "write"]);
		});

		test("a goal tool B selected itself survives recovery when B has no goal", async () => {
			const { f, error } = await abandonedEntry({ goalInB: false, bTools: ["read", "write", "goal"] });
			expect(error).toBeInstanceOf(GoalOwnerStale);
			expect(f.session.getGoalModeState()).toBeUndefined();
			expect(f.tools().toSorted()).toEqual(["goal", "read", "write"]);
		});
	});

	describe("an abandoned entry's recovery restore", () => {
		for (const goalInC of [true, false]) {
			test(`is finished by the session change before transcript C ${goalInC ? "with" : "without"} a goal chooses its tools`, async () => {
				const f = fakeSession(async () => true);
				f.session.setGoalModeState(undefined);
				const swap = f.session.setActiveToolsByName;
				const entryEntered = Promise.withResolvers<void>();
				const entryRelease = Promise.withResolvers<void>();
				const recoveryEntered = Promise.withResolvers<void>();
				const recoveryRelease = Promise.withResolvers<void>();
				// A's entry swap is held first; the recovery restore it later starts is held second.
				f.session.setActiveToolsByName = async names => {
					f.session.setActiveToolsByName = async recoveryNames => {
						f.session.setActiveToolsByName = swap;
						recoveryEntered.resolve();
						await recoveryRelease.promise;
						await swap(recoveryNames);
					};
					entryEntered.resolve();
					await entryRelease.promise;
					await swap(names);
				};
				const entry = f.controller.createForHostPrompt({ objective: "A" }, { stamp: {} }).then(
					() => undefined,
					(error: unknown) => error,
				);
				await entryEntered.promise;

				// Transcript B (no goal) is adopted while A's entry is still swapping.
				f.setOwner(false);
				await f.controller.beginSessionChange();
				f.transcript.id = "t2";
				await swap(["read", "write"]);
				await f.controller.endSessionChange({ detachedRun: true });
				await f.controller.settled();

				// A's entry is abandoned: its recovery restore starts and is held.
				entryRelease.resolve();
				await recoveryEntered.promise;

				let changeBegun = false;
				const begin = f.controller.beginSessionChange().then(() => {
					changeBegun = true;
				});
				await nextMacrotask();
				// The change to C waits for the recovery: C cannot choose tools before it has landed.
				expect(changeBegun).toBe(false);

				recoveryRelease.resolve();
				expect(await entry).toBeInstanceOf(GoalOwnerStale);
				await begin;
				f.transcript.id = "t3";
				await swap(["read", "exec"]);
				if (goalInC) f.journalGoal();
				await f.controller.endSessionChange({ detachedRun: true });
				await f.controller.settled();

				expect(f.tools()).toEqual(goalInC ? ["read", "exec", "goal"] : ["read", "exec"]);
			});
		}
	});

	describe("a stamped pause's tool restore", () => {
		for (const goalInB of [true, false]) {
			test(`is finished by the session change before transcript B ${goalInB ? "with" : "without"} a goal chooses its tools`, async () => {
				const f = fakeSession(async () => true);
				f.session.setGoalModeState(undefined);
				await f.controller.createForHostPrompt({ objective: "A" }, { stamp: {} });
				expect(f.tools()).toEqual(["read", "goal"]);
				// A's goal is paused, as the runtime would leave it; only the tool restore remains.
				const paused = f.session.getGoalModeState();
				f.session.setGoalModeState(
					paused && { ...paused, enabled: false, goal: { ...paused.goal, status: "paused" } },
				);

				const swap = f.session.setActiveToolsByName;
				const entered = Promise.withResolvers<void>();
				const release = Promise.withResolvers<void>();
				f.session.setActiveToolsByName = async names => {
					f.session.setActiveToolsByName = swap;
					entered.resolve();
					await release.promise;
					await swap(names);
				};
				const pausing = f.controller.pause({ stamp: {} });
				await entered.promise;

				let changeBegun = false;
				const begin = f.controller.beginSessionChange().then(() => {
					changeBegun = true;
				});
				await nextMacrotask();
				// The change waits for A's restore: B cannot choose tools before it has landed.
				expect(changeBegun).toBe(false);

				release.resolve();
				await pausing;
				await begin;
				expect(f.tools()).toEqual(["read"]);
				f.setOwner(false);
				f.transcript.id = "t2";
				await swap(["read", "write"]);
				if (goalInB) f.journalGoal();
				await f.controller.endSessionChange({ detachedRun: true });
				await f.controller.settled();

				expect(f.tools()).toEqual(goalInB ? ["read", "write", "goal"] : ["read", "write"]);
			});
		}
	});

	test("an ACP continuation gate that is closed admits no continuation turn", async () => {
		const admitted: string[] = [];
		let promptOpen = true;
		const { controller } = fakeSession(
			async customType => {
				admitted.push(customType);
				return true;
			},
			{ canAutoContinue: () => promptOpen },
		);

		// The owning prompt closes while the continuation waits for idle: dropped at admission.
		controller.observe(agentEnd);
		promptOpen = false;
		await nextMacrotask();
		expect(admitted).toEqual([]);
		expect(controller.continuationPending).toBe(false);

		// With no prompt open, a yield does not even schedule one.
		controller.observe(agentEnd);
		expect(controller.continuationPending).toBe(false);

		promptOpen = true;
		controller.observe(agentEnd);
		await nextMacrotask();
		expect(admitted).toEqual(["goal-continuation"]);
	});
});
