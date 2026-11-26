# Texts From Your Future Self

[![make.fun · u-motasimfuad-texts-from-your-future-self-dd44595e](https://make.fun/badge/u-motasimfuad-texts-from-your-future-self-dd44595e.svg)](https://make.fun/bounty/u-motasimfuad-texts-from-your-future-self-dd44595e?utm_source=github&utm_medium=readme&utm_campaign=u-motasimfuad-texts-from-your-future-self-dd44595e)
[![rank](https://make.fun/badge/u-motasimfuad-texts-from-your-future-self-dd44595e/qw123gyj-dev/u-motasimfuad-texts-from-your-future-self-dd44595e/rank.svg)](https://make.fun/bounty/u-motasimfuad-texts-from-your-future-self-dd44595e/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-motasimfuad-texts-from-your-future-self-dd44595e)
[![reward](https://make.fun/badge/u-motasimfuad-texts-from-your-future-self-dd44595e/qw123gyj-dev/u-motasimfuad-texts-from-your-future-self-dd44595e/reward.svg)](https://make.fun/bounty/u-motasimfuad-texts-from-your-future-self-dd44595e?utm_source=github&utm_medium=readme&utm_campaign=u-motasimfuad-texts-from-your-future-self-dd44595e)

Your future self can only send you one text message. One line, no
follow-ups. This program holds fourteen candidate lines and picks the
single best one — deterministically.

## What it does

`main.ts` is a deterministic one-line picker with no dependencies, no
network access, and no randomness. It grades each of the fourteen
candidate texts from your future self on five criteria:

- **Poignancy** (30%) — does it land in the chest?
- **Wit** (20%) — is there a joke or a turn of phrase?
- **Surprise** (20%) — does it say something you didn't see coming?
- **Relatability** (15%) — could almost anyone feel addressed?
- **Memorability** (15%) — will you still remember it tomorrow?

On top of the hand-graded criteria, a deterministic feature bonus
(-5 to +5) is computed from the text itself: line length in the
sweet spot, second-person directness, a concrete time anchor, a
single sentence, a quoted word. Ties break by base score, then
poignancy, then candidate id — so the ranking is total: run it a
thousand times and you get the same winner every time.

## How to run it

```bash
node main.ts            # print the winning line + score breakdown
node main.ts --list     # print the full ranked table
node main.ts --all      # print every candidate with its scores
node main.ts --json     # print the winner as JSON
node main.ts --help     # print usage
```

Every run also writes the winning line to `entry.txt` — that file is
the entry the grader reads, so it is written on every run mode, not
just the default one. The location is `$MAKEFUN_OUTPUT_DIR/entry.txt`
when `MAKEFUN_OUTPUT_DIR` is set, and `/output/entry.txt` otherwise
(the directory is created if it does not exist yet). The file holds
exactly the winning line, a single line, and the program reads it
back after writing to verify the bytes match the winner before
reporting success.

```bash
MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts   # writes /tmp/out/entry.txt
```

Requires Node.js 22.6+ (uses built-in TypeScript type stripping).
With an older Node, compile first:

```bash
npx tsc main.ts --outDir dist && node dist/main.js
```

## The winning line

> "Turns out the 'wasted' year was the one that saved you."

Candidate `c06`, scored **83.0 / 100** — base 78.0 plus a +5 feature
bonus. Poignancy 8, wit 6, surprise 9, relatability 8, memorability 8.
The runner-up is `c03`: "Stop rehearsing the apology. They already
forgave you in 2029." at 79.0.

## Why deterministic

The whole joke of a text from your future self is that it is fixed.
The future already happened. The message does not change when you
re-read it. A picker that rolled dice would be lying about its own
premise.

## License

MIT. See [LICENSE](LICENSE).
