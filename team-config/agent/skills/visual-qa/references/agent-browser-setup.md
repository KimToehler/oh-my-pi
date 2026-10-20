# agent-browser setup (Web capture fallback)

Last-resort fallback for the Web capture path in Step 2. Prefer the omp `browser` global
in an `eval` cell (see `xd://eval/browser`), then a `playwright-core` code cell. Use this only
when neither is available (no usable Chromium).
[agent-browser](https://github.com/vercel-labs/agent-browser) is a standalone CLI that
drives a real Chromium and can screenshot a page at a fixed viewport — exactly what the
`image-diff` evidence step needs.

Repo: https://github.com/vercel-labs/agent-browser

## Install

```
npm install -g agent-browser && agent-browser install
```

`npm install -g agent-browser` installs the CLI globally; `agent-browser install` downloads the
managed browser it drives. If Bun is already available, `bun add -g agent-browser && agent-browser install`
is equivalent, but npm is the default because Bun is not required.

Confirm it is ready and discover the current flags:

```
agent-browser --help
```

## Capture a screenshot at a fixed viewport

Set the viewport first, then screenshot — this guarantees the ACTUAL capture matches the
REFERENCE viewport so `image-diff` compares like-for-like:

```
agent-browser set viewport 1280 720      # width height (add a third arg, e.g. 2, for retina scale)
agent-browser screenshot actual.png      # add --full for full-page, --screenshot-dir ./shots for a custom dir
```

Then feed the PNG into the diff exactly as in Step 2:

```
node "$SKILL_DIR/scripts/visual-qa.mjs" image-diff <reference.png> actual.png
```

Match the viewport numbers to whatever the reference/mock was captured at; mismatched
dimensions make `dimensionsMatch` false and inflate `diffRatio`. Run `agent-browser --help`
for the full command set (navigation, batch, annotate, format/quality flags).
