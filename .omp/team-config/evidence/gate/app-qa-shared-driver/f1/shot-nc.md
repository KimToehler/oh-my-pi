# F1 shot-nc (*test*)

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309`.

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (121 tests, 121 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: screenshot the flow and its subflow both naming home copy neither and fail the run`
- `flow: screenshot a copy failing with EACCES prints its code`
- `flow: screenshot a named screenshot the sweep removes fails the run`
- `flow: screenshot a recorded screenshot with no file fails the run`
- `flow: screenshot an unreadable command record fails a passing run`
- `flow: screenshot a clash stays a clash when the sweep removed its one file`
- `flow: screenshot two files named home in different folders copy neither and fail the run`
- `flow: screenshot two files named home in different folders, one swept, export neither`
- `flow: screenshot the flow and its subflow both naming home copy neither and fail the run`
- `flow: screenshot a clash stays a clash when the sweep removed its one file`
- `flow: screenshot two files named home in different folders copy neither and fail the run`
- `flow: screenshot an unreadable command record fails a passing run`
- `flow: screenshot a recorded screenshot with no file fails the run`

Broken-copy controls (`f1/broken-copies-log.txt`, command `node f1/broken-copies.mjs <qa.mjs> <qa.test.mjs>` on the head, each copy run through `QA_UNDER_TEST`; the lines below are copied from that log):

```
caught screenshot-clash-exports-one (exit 1, pattern ^(flow: screenshot))
  failed: flow: screenshot the flow and its subflow both naming home copy neither and fail the run
  failed: flow: screenshot a clash stays a clash when the sweep removed its one file
  failed: flow: screenshot two files named home in different folders copy neither and fail the run
  failed: flow: screenshot two files named home in different folders, one swept, export neither
```

```
caught screenshot-eacces-as-existing-target (exit 1, pattern ^(flow: screenshot))
  failed: flow: screenshot a copy failing with EACCES prints its code
```

```
caught screenshots-enumerated-after-sweep (exit 1, pattern ^(flow: screenshot))
  failed: flow: screenshot the flow and its subflow both naming home copy neither and fail the run
  failed: flow: screenshot a clash stays a clash when the sweep removed its one file
  failed: flow: screenshot two files named home in different folders copy neither and fail the run
  failed: flow: screenshot two files named home in different folders, one swept, export neither
  failed: flow: screenshot an unreadable command record fails a passing run
  failed: flow: screenshot a recorded screenshot with no file fails the run
  failed: flow: screenshot a named screenshot the sweep removes fails the run
```

```
caught screenshot-unreadable-record-ignored (exit 1, pattern ^(flow: screenshot))
  failed: flow: screenshot an unreadable command record fails a passing run
```

```
caught screenshots-grouped-by-source-path (exit 1, pattern ^(flow: screenshot))
  failed: flow: screenshot the flow and its subflow both naming home copy neither and fail the run
  failed: flow: screenshot a clash stays a clash when the sweep removed its one file
  failed: flow: screenshot two files named home in different folders copy neither and fail the run
  failed: flow: screenshot two files named home in different folders, one swept, export neither
  failed: flow: screenshot a recorded screenshot with no file fails the run
  failed: flow: screenshot a named screenshot the sweep removes fails the run
  failed: flow: screenshot a copy failing with EACCES prints its code
```

## Observation

The suite fails each broken copy (exporting one `home.png`, reporting `EACCES` as an existing target, enumerating screenshots after the sweep, ignoring an unreadable command record, grouping by source path instead of file name, which the two-folder `home` tests catch). The driver of commit `cc62771944`, which counted `takeScreenshot/` files instead of Maestro's command records, fails six of the ten screenshot tests (`f1/cc6277-driver-log.txt`): the five command-record tests, and the short-username screenshot test of task 1.10, because that driver still flags a value shorter than six bytes in a binary file.
