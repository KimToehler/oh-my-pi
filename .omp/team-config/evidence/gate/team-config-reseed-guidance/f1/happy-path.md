# F1 row: happy path

Head: cb6aa6219eb150a4a020f288070211cf1cdb286c. Config: the positive session's edited config.yml (/tmp/rs/pos/agent/config.yml).
command: cd /tmp/rs/happy && PI_CONFIG_FILES=/tmp/rs/pos/agent/config.yml omp -p --session-dir /tmp/rs/happy/sessions "Reply with exactly: OK"
Reply: OK
Session file: /tmp/rs/happy/sessions/2026-11-20T13-58-28-513Z_01a1f940-61a1-7403-a024-4c398751b6d2.jsonl
Assistant provider/model: anthropic/claude-opus-5-5 
PI_CONFIG_FILES=/tmp/rs/pos/agent/config.yml omp config get modelRoles.default: anthropic/claude-opus-5-5:high
Note: the member's real default is also anthropic/claude-opus-5-5:high, so this row shows the edited config loads and runs natively; the discriminating evidence is manual-route.md.
