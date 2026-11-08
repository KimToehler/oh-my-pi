# Maestro 2.12.1: a screenshot name takes an environment value

Probe for the F1 row `sweep-name`, 2026-11-08, synthetic value, simulator `onara-f1`. Flow `name.yaml`:

```yaml
appId: com.apple.Preferences
---
- takeScreenshot: sign-in-${MAESTRO_DEV_USER}
```

```
$ maestro test --no-ansi --udid 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A -e MAESTRO_DEV_USER=synthuser --debug-output <scratch>/debug --test-output-dir <scratch>/out <scratch>/name.yaml
Running on onara-f1 - iOS 26.4 - 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A
 > Flow name
 COMPLETED
(exit 0)
$ find <scratch> -iname '*.png'
<scratch>/out/2026-11-08_134450/name/takeScreenshot/sign-in-synthuser.png
```

Observation: the value of `MAESTRO_DEV_USER` became part of the screenshot file name; the flow file holds only `${MAESTRO_DEV_USER}`.
