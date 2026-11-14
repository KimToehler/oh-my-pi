# F1 row ce-overlap, attempt 12

- Head under test: 6697d1c15c (skill and rules deployed from 5d431a0686 with scripts/deploy-local.sh; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

## Observation

PASS. Run by the QA lane after the unlocked batch: the fixture marker window (`QAFixture marker 300 300 500 200`: magenta, text `QA-MARKER-OVERLAP`) was placed over the scratch weaver `:shell` window (id 2909, pid 43757); frames from `computer.windows()`, one whole-window `win.screenshot({ silent: true })` of the target resolved by id (no zoom, no region), frames again.
- Before and after: target `MainKt` "Weaver" at (48, 81, 1440×900), z 4; marker `QAFixture` "QA Marker" at (300, 268, 500×232), z 1, above the target; overlap rectangle (300, 268, 500×232), non-empty both times.
- The capture (1280×800 after downscaling) is the target window and shows weaver's session screen; a pixel count finds 0 magenta pixels and the marker text is not in it. The capture is kept by the lane in `/tmp/f1cu/overlap-a12/` with `frames.json`, not in this evidence.

## Earlier attempt, kept

## F1 row ce-overlap

- Head under test: 220924a05c (skill and rule deployed from 220924a05c; deployed files compared equal with cmp)
- Probe: run by the QA lane in its own eval session (no session under test); `/tmp/f1cu/overlap-probe.js` and the fixture `/tmp/f1cu/fixture/fixture.swift`

### Frame record

```json
{
  "target": "MainKt",
  "before": {
    "target": {
      "z": 6,
      "app": "MainKt",
      "title": "Weaver",
      "x": 48,
      "y": 81,
      "width": 1440,
      "height": 900
    },
    "marker": {
      "z": 2,
      "app": "QAFixture",
      "title": "QA Marker",
      "x": 300,
      "y": 268,
      "width": 700,
      "height": 232
    },
    "overlap": {
      "x": 300,
      "y": 268,
      "width": 700,
      "height": 232
    },
    "markerAbove": true
  },
  "after": {
    "target": {
      "z": 6,
      "app": "MainKt",
      "title": "Weaver",
      "x": 48,
      "y": 81,
      "width": 1440,
      "height": 900
    },
    "marker": {
      "z": 2,
      "app": "QAFixture",
      "title": "QA Marker",
      "x": 300,
      "y": 268,
      "width": 700,
      "height": 232
    },
    "overlap": {
      "x": 300,
      "y": 268,
      "width": 700,
      "height": 232
    },
    "markerAbove": true
  },
  "capture": {
    "path": "/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/omp-computer-15ccd57855a8ff74.png",
    "width": 1280,
    "height": 800
  }
}```

### Observation

Attempt 10, run by the QA lane after the unlocked batch on head 220924a05c. PASS.

- The QA lane started the disposable fixture's marker window (`QAFixture marker 300 300 700 200`: magenta, text `QA-MARKER-OVERLAP`) over the scratch weaver `:shell` window and ran `/tmp/f1cu/overlap-probe.js` with target app `MainKt`: frames from `computer.windows()`, one whole-window `win.screenshot({ silent: true })` of the target (no zoom, no region), frames again.
- Before and after: target `MainKt` "Weaver" at (48, 81, 1440×900), z 6; marker `QAFixture` "QA Marker" at (300, 268, 700×232), z 2, above the target; overlap rectangle (300, 268, 700×232), non-empty both times.
- The capture is the target window (1280×800 after downscaling) and shows weaver's session screen; a pixel count over it finds 0 pixels of the marker's magenta, and the marker text is not in it. The frame record is kept below; the capture image is kept by the lane in `/tmp/f1cu/overlap-a10/`, not in this evidence.
