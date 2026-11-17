import type { AsyncJobManager } from "@oh-my-pi/pi-coding-agent/async";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";

/**
 * Wait out the session's owned jobs, their deliveries, and the run their results start.
 * These jobs are registered outside any run, so no open run waits for them on its own.
 */
export async function settleOwnedJobs(session: AgentSession, manager: AsyncJobManager): Promise<void> {
	const ownerId = session.getAgentId();
	if (!ownerId) throw new Error("Expected an agent id");
	await manager.waitForOwnerJobs(ownerId, { excludeSuppressed: true });
	await manager.drainDeliveries({ filter: { ownerId } });
	await session.waitForRunEnd();
}
