# F1 row: edge, personal entries inside the rewritten settings

Head: cb6aa6219eb150a4a020f288070211cf1cdb286c. Edited file: /tmp/rs/pos/agent/config.yml (positive session in manual-route.md).
Personal entries after the edit:
```
41:    github-copilot/gpt-6.1-sol:
42:      - github-copilot/claude-opus-5-5
49:  - github-copilot/**
163:steeringMode: all
```
diff (comments stripped) edited config.yml vs team-config/seed/config.yml; only the personal settings differ:
```
36,37d35
<     github-copilot/gpt-6.1-sol:
<       - github-copilot/claude-opus-5-5
44d41
<   - github-copilot/**
154c151
< steeringMode: all
---
> steeringMode: one-at-a-time
```
