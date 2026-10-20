/**
 * RPC wire types for the `goal` command. The lifecycle behind it is
 * `GoalHostController` (`goals/host-controller.ts`), shared with ACP.
 */
import type { GoalHostCommand, GoalHostOp, GoalHostResult } from "../../goals/host-controller";

export type RpcGoalOp = GoalHostOp;

export interface RpcGoalCommand {
	op: RpcGoalOp;
	objective?: string;
	token_budget?: number;
}

export type RpcGoalResult = GoalHostResult;

/** Translate the snake_case RPC wire command into the host controller's command. */
export function toGoalHostCommand(command: RpcGoalCommand): GoalHostCommand {
	return { op: command.op, objective: command.objective, tokenBudget: command.token_budget };
}
