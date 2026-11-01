import json, sys
# F1 helper: scripted fake IdP responses
attempts = 0
for line in sys.stdin:
    attempts += 1
    print(json.dumps({"attempts": attempts, "status": line.strip()}))
