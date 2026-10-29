# Usage: jq -s -r --arg t <toolCallId> -f metrics.jq events.jsonl
# Measures the tool_call_update frames Air journalled for one call (tasks.md 4.2).
[.[] | select(.type == "ToolCallUpdated" and .payload.toolCallId == $t)] as $u
| ([$u[] | select(.payload.status == "completed")] | first) as $end
| "IN_PROGRESS_COUNT \([$u[] | select(.payload.status == "in_progress")] | length)",
  "IN_PROGRESS_WITH_RAWOUTPUT \([$u[] | select(.payload.status == "in_progress" and (.payload | has("rawOutput")))] | length)",
  "CONSECUTIVE_DUPLICATES \([range(1; $u | length) as $i | select($u[$i].payload.status == "in_progress" and $u[$i].payload == $u[$i - 1].payload)] | length)",
  "END_WITH_RAWOUTPUT \(if $end != null and ($end.payload | has("rawOutput")) then 1 else 0 end)",
  "JOB_FINAL_AFTER_END_WITH_RAWOUTPUT \(if [$u[] | select(.payload.status == "completed" and .payload.rawOutput.details.async.state == "completed" and .seq > $end.seq)] | length > 0 then 1 else 0 end)"
