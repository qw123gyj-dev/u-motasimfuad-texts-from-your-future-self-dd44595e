/**
 * Texts From Your Future Self
 * ===========================
 *
 * A deterministic one-line picker.
 *
 * The premise: your future self can only send you one text message, one
 * line, no follow-ups. Fourteen candidate lines are held in this file.
 * A deterministic scorer grades each line on five criteria — poignancy,
 * wit, surprise, relatability, memorability — and picks the single best
 * winner. No network. No randomness. No clock. Run it a thousand times
 * and you get the same winner, the same scores, the same breakdown.
 *
 * Why deterministic matters here: the whole joke of a text from your
 * future self is that it is fixed. The future already happened. The
 * message does not change when you re-read it. A picker that rolled
 * dice would be lying about its own premise.
 *
 * Usage:
 *   npx tsx main.ts            print the winning line + score breakdown
 *   npx tsx main.ts --list     print the full ranked table
 *   npx tsx main.ts --json     print the winner as JSON
 *   npx tsx main.ts --all      print every candidate with its scores
 *
 * The file is plain TypeScript with no dependencies. If you do not have
 * tsx, `npx tsc main.ts --outDir dist && node dist/main.js` works too.
 */

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The five criteria every candidate is graded on. Each is 0..10. */
interface Scores {
  /** Does it land in the chest? Grief, pride, tenderness, regret. */
  poignancy: number;
  /** Is there a joke, a turn of phrase, a little verbal snap? */
  wit: number;
  /** Does it say something you did not see coming? */
  surprise: number;
  /** Could almost anyone read it and feel addressed? */
  relatability: number;
  /** Will you still remember it tomorrow morning? */
  memorability: number;
}

/** One candidate line from your future self. */
interface Candidate {
  /** Stable short id, used for tie-breaking and for --pick lookups. */
  id: string;
  /** The one line. Exactly one line, no newline, no second sentence. */
  text: string;
  /** A one-line note on the voice: who is speaking, and when. */
  voice: string;
  /** Hand-graded scores. See the scoring notes below for the rubric. */
  scores: Scores;
}

/** A candidate after scoring: base scores plus derived adjustments. */
interface ScoredCandidate {
  candidate: Candidate;
  /** Weighted total of the five hand-graded criteria, 0..100. */
  baseScore: number;
  /** Deterministic feature bonus/penalty, -5..+5. */
  featureBonus: number;
  /** Final score: baseScore + featureBonus, clamped to 0..100. */
  total: number;
  /** Per-criterion weighted contributions, for the breakdown printout. */
  contributions: Scores;
}

/**
 * How much each criterion is worth. The five weights add up to 1.00,
 * so a candidate's weighted total lands on a 0..100 scale once the
 * grades (0..10 each) are multiplied out.
 *
 * Poignancy carries the most weight because the first test in the
 * brief is whether the line lands in the chest. Wit and surprise
 * share the next tier: a text from the future needs a turn, and it
 * needs to say something unseen. Relatability and memorability split
 * the remainder — the line should feel addressed to almost anyone,
 * and it should still be there tomorrow morning.
 */
const WEIGHTS: Scores = {
  poignancy: 0.3, // lands in the chest: grief, pride, tenderness, regret
  wit: 0.2, // a joke, a turn of phrase, a little verbal snap
  surprise: 0.2, // says something you did not see coming
  relatability: 0.15, // almost anyone could read it and feel addressed
  memorability: 0.15, // will you still remember it tomorrow morning
};

/**
 * What a hand grade means, 0..10 on each criterion:
 *
 *   0-2  the line fails the criterion outright
 *   3-4  weak — the quality is there, but faint
 *   5-6  solid — does the job, nothing more
 *   7-8  strong — genuinely good, would survive a re-read
 *   9-10 exceptional — the rare line that earns the criterion alone
 *
 * Hand grades are a point of view, deliberately held: they say what
 * makes a one-line message from the future work. They are not the
 * whole score, though. The feature bonus further down is computed
 * from the text itself, so a line cannot win on opinion alone — it
 * has to be built well, too.
 */

// ---------------------------------------------------------------------------
// The fourteen candidates
// ---------------------------------------------------------------------------

const CANDIDATES: Candidate[] = [
  {
    id: "c01",
    text: "You finally called your mother back, and it was the best call of your life.",
    voice: "You, ten years on, after the call you kept postponing.",
    scores: {
      poignancy: 9,
      wit: 3,
      surprise: 6,
      relatability: 9,
      memorability: 8,
    },
  },
  {
    id: "c02",
    text: "The plant died, the job didn't, and somehow that was the whole lesson.",
    voice: "You, five years on, reporting from the other side of a bad week.",
    scores: {
      poignancy: 6,
      wit: 8,
      surprise: 6,
      relatability: 8,
      memorability: 7,
    },
  },
  {
    id: "c03",
    text: "Stop rehearsing the apology. They already forgave you in 2029.",
    voice: "You, four years on, tired of watching yourself rehearse.",
    scores: {
      poignancy: 8,
      wit: 7,
      surprise: 8,
      relatability: 7,
      memorability: 9,
    },
  },
  {
    id: "c04",
    text: "You kept the ticket stub. Good. You'll need it for the story.",
    voice: "You, twenty years on, keeping souvenirs on purpose now.",
    scores: {
      poignancy: 7,
      wit: 6,
      surprise: 7,
      relatability: 6,
      memorability: 8,
    },
  },
  {
    id: "c05",
    text: "The version of you that worried about this is gone. You're still here.",
    voice: "You, three years on, after the thing you feared never happened.",
    scores: {
      poignancy: 8,
      wit: 5,
      surprise: 5,
      relatability: 9,
      memorability: 7,
    },
  },
  {
    id: "c06",
    text: "Turns out the 'wasted' year was the one that saved you.",
    voice: "You, seven years on, re-grading the year you wrote off.",
    scores: {
      poignancy: 8,
      wit: 6,
      surprise: 9,
      relatability: 8,
      memorability: 8,
    },
  },
  {
    id: "c07",
    text: "You bought the cheap shoes again. Your feet forgive you. Barely.",
    voice: "You, two years on, still negotiating with your own feet.",
    scores: {
      poignancy: 4,
      wit: 9,
      surprise: 5,
      relatability: 8,
      memorability: 7,
    },
  },
  {
    id: "c08",
    text: "Nobody remembers the presentation. Everybody remembers that you showed up.",
    voice: "You, six years on, after the meeting that felt like everything.",
    scores: {
      poignancy: 7,
      wit: 6,
      surprise: 6,
      relatability: 9,
      memorability: 7,
    },
  },
  {
    id: "c09",
    text: "The dog is fine. He outlived your worst year and never once held it against you.",
    voice: "You, eight years on, with the dog asleep at your feet.",
    scores: {
      poignancy: 9,
      wit: 5,
      surprise: 6,
      relatability: 7,
      memorability: 8,
    },
  },
  {
    id: "c10",
    text: "You finally finished it. It took nine years, two laptops, and one very patient friend.",
    voice: "You, nine years on, holding the finished thing.",
    scores: {
      poignancy: 8,
      wit: 7,
      surprise: 5,
      relatability: 7,
      memorability: 8,
    },
  },
  {
    id: "c11",
    text: "The quiet one in the back row? They end up running the whole place.",
    voice: "You, fifteen years on, watching the reunion from the corner.",
    scores: {
      poignancy: 6,
      wit: 6,
      surprise: 8,
      relatability: 7,
      memorability: 7,
    },
  },
  {
    id: "c12",
    text: "You stopped waiting for permission somewhere around Tuesday.",
    voice: "You, one year on, noticing the exact day it changed.",
    scores: {
      poignancy: 6,
      wit: 8,
      surprise: 7,
      relatability: 8,
      memorability: 8,
    },
  },
  {
    id: "c13",
    text: "Your future self says hi. Also: drink water. You'll thank me in 2041.",
    voice: "You, sixteen years on, keeping it practical and a little smug.",
    scores: {
      poignancy: 4,
      wit: 8,
      surprise: 7,
      relatability: 8,
      memorability: 9,
    },
  },
  {
    id: "c14",
    text: "The thing you're afraid to start is the thing they'll thank you for.",
    voice: "You, twelve years on, thanking yourself retroactively.",
    scores: {
      poignancy: 8,
      wit: 4,
      surprise: 6,
      relatability: 9,
      memorability: 8,
    },
  },
];

// ---------------------------------------------------------------------------
// Features read off the text itself
// ---------------------------------------------------------------------------

/**
 * How many words a line has. A "word" is a whitespace-separated
 * token containing at least one letter, so numbers and punctuation
 * on their own do not inflate the count. Deterministic by
 * construction: the same line always yields the same count.
 */
function countWords(text: string): number {
  let count = 0;
  for (const token of text.split(/\s+/)) {
    if (/[a-zA-Z]/.test(token)) count += 1;
  }
  return count;
}

/** The second-person words that make a text talk directly to you. */
const SECOND_PERSON_WORDS = ["you", "your", "you're", "you'll", "yours"];

/**
 * How many of the line's words are second-person. A text from your
 * future self should talk to you, not about you in the third
 * person. More second-person words, up to a point, means a more
 * direct message — the future self is in the room with you.
 */
function countSecondPerson(text: string): number {
  const wanted = new Set(SECOND_PERSON_WORDS);
  let count = 0;
  for (const token of text.toLowerCase().split(/[^a-z']+/)) {
    if (token.length > 0 && wanted.has(token)) count += 1;
  }
  return count;
}

/** Words and patterns that pin a line to a concrete moment in time. */
const TIME_ANCHORS = [
  "20\\d\\d",
  "19\\d\\d",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "year",
  "years",
  "month",
  "months",
  "tomorrow",
  "yesterday",
  "decade",
];

/**
 * True when the line names a concrete time anchor — a year, a
 * weekday, a span like "nine years", a "Tuesday". Time anchors are
 * what make a future-self text feel like a real message and not a
 * fortune cookie: the future self knows when it is writing from.
 */
function hasTimeAnchor(text: string): boolean {
  const pattern = new RegExp(`\\b(${TIME_ANCHORS.join("|")})\\b`, "i");
  return pattern.test(text);
}

/**
 * True when the line ends with a full stop and contains exactly one
 * sentence. A text message is one breath; a second sentence is a
 * second text, and the premise only allows one message.
 */
function isSingleSentence(text: string): boolean {
  const trimmed = text.trim();
  const terminators = trimmed.split("").filter((ch) => ch === "." || ch === "!" || ch === "?");
  if (terminators.length !== 1) return false;
  const last = trimmed[trimmed.length - 1];
  return last === "." || last === "!" || last === "?";
}

/**
 * True when the line contains a quoted word or phrase. Quoted words
 * ("wasted", "cheap") signal the future self quoting your present
 * self back to you — a small, sharp rhetorical move that says: I
 * heard what you called it, and I am answering in your own words.
 */
function hasQuotedWord(text: string): boolean {
  return /'[^']+'/.test(text);
}

/**
 * Keep a number inside a closed range. One place for both bounds:
 * the feature bonus is clamped to -5..+5 and the final total to
 * 0..100, instead of each call site re-implementing the same guard.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The deterministic feature bonus for a candidate, -5..+5.
 *
 * The bonus is earned from the text itself, so a line cannot win on
 * hand grades alone — it has to be built well:
 *
 *   +2  line is 10-18 words long (the sweet spot for one text)
 *   -2  line is under 7 words (too thin) or over 22 (too long to text)
 *   +1  at least two second-person words (it talks to you, directly)
 *   +1  has a concrete time anchor (a year, a weekday, a span)
 *   +1  is a single sentence (one breath, one text)
 *   +1  quotes a word back at you (the future self heard you)
 *   -1  contains the word "very" (a filler word; the line should not)
 *
 * The cap keeps the feature layer honest: it can break ties and
 * reward craft, but it can never overturn a large gap in the
 * hand-graded criteria.
 */
function featureBonus(candidate: Candidate): number {
  const text = candidate.text;
  let bonus = 0;

  // Length: the sweet spot is 10-18 words. Shorter than 7 is too
  // thin to land, longer than 22 is too long to text.
  const words = countWords(text);
  if (words >= 10 && words <= 18) bonus += 2;
  if (words < 7 || words > 22) bonus -= 2;

  // Directness: at least two second-person words means the future
  // self is talking to you, not narrating about you.
  if (countSecondPerson(text) >= 2) bonus += 1;

  // A time anchor makes the message feel sent from a real future.
  if (hasTimeAnchor(text)) bonus += 1;

  // One sentence, one breath, one text.
  if (isSingleSentence(text)) bonus += 1;

  // Quoting your own word back at you is the future self listening.
  if (hasQuotedWord(text)) bonus += 1;

  // "Very" is filler: a line that needs it is padding itself.
  if (/\bvery\b/i.test(text)) bonus -= 1;

  return clamp(bonus, -5, 5);
}

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

/**
 * Weighted contribution of one criterion: grade (0..10) times weight,
 * scaled to a 0..100 total. Poignancy 9 at weight 0.30, for example,
 * contributes 27 points.
 */
function contribution(score: number, weight: number): number {
  return score * weight * 10;
}

/** The five criteria, in the order the breakdown prints them. */
const CRITERION_KEYS: (keyof Scores)[] = [
  "poignancy",
  "wit",
  "surprise",
  "relatability",
  "memorability",
];

/**
 * Score one candidate. Pure function: same candidate in, same
 * numbers out, every time. The base score is the weighted sum of
 * the five hand grades, in the fixed order above; the feature bonus
 * comes from the text itself; the total is clamped to 0..100.
 */
function scoreCandidate(candidate: Candidate): ScoredCandidate {
  const s = candidate.scores;
  const contributions: Scores = {
    poignancy: 0,
    wit: 0,
    surprise: 0,
    relatability: 0,
    memorability: 0,
  };
  let baseScore = 0;
  for (const key of CRITERION_KEYS) {
    contributions[key] = contribution(s[key], WEIGHTS[key]);
    baseScore += contributions[key];
  }

  const bonus = featureBonus(candidate);
  const total = clamp(baseScore + bonus, 0, 100);

  return { candidate, baseScore, featureBonus: bonus, total, contributions };
}

/**
 * Rank all candidates, best first.
 *
 * The ordering is fully deterministic. Ties on the total are broken
 * by the higher base score, then by higher poignancy, then by the
 * candidate id in ascending order. Ids are unique, so the order is
 * total: two runs can never disagree about who won.
 */
function rankAll(candidates: Candidate[]): ScoredCandidate[] {
  const scored = candidates.map(scoreCandidate);
  scored.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.baseScore !== a.baseScore) return b.baseScore - a.baseScore;
    const poignancyGap = b.candidate.scores.poignancy - a.candidate.scores.poignancy;
    if (poignancyGap !== 0) return poignancyGap;
    if (a.candidate.id === b.candidate.id) return 0;
    return a.candidate.id < b.candidate.id ? -1 : 1;
  });
  return scored;
}

/** The single winning candidate: the first entry of the ranking. */
function pickWinner(candidates: Candidate[]): ScoredCandidate {
  return rankAll(candidates)[0];
}

/**
 * Check one candidate's hand grades are all inside 0..10. Throws
 * naming the candidate and the offending criterion.
 */
function checkGrades(candidate: Candidate): void {
  for (const key of CRITERION_KEYS) {
    const value = candidate.scores[key];
    if (!Number.isFinite(value) || value < 0 || value > 10) {
      throw new Error(`Candidate ${candidate.id} has an out-of-range ${key} score: ${value}`);
    }
  }
}

/**
 * Validate the candidate set before scoring. Guards the premise:
 * at least one line, exactly one line each, no empty texts, no
 * duplicate ids, every hand grade inside 0..10. Throws on the first
 * problem found, with a message naming the offending candidate.
 */
function validateCandidates(candidates: Candidate[]): void {
  if (candidates.length === 0) {
    throw new Error("No candidates: the picker needs at least one line.");
  }
  const seenIds = new Set<string>();
  for (const c of candidates) {
    if (seenIds.has(c.id)) {
      throw new Error(`Duplicate candidate id: ${c.id}`);
    }
    seenIds.add(c.id);
    if (!c.text || c.text.trim().length === 0) {
      throw new Error(`Candidate ${c.id} has an empty text.`);
    }
    if (c.text.includes("\n")) {
      throw new Error(`Candidate ${c.id} is more than one line.`);
    }
    checkGrades(c);
  }
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

/** One decimal place, for the breakdown and JSON printouts. */
function oneDecimal(n: number): string {
  return n.toFixed(1);
}

/** A score as a fixed-width "x.x" string, for the ranked table. */
function fmt(n: number): string {
  const fixed = n.toFixed(1);
  return fixed.length >= 4 ? fixed : " ".repeat(4 - fixed.length) + fixed;
}

/** A horizontal rule for the tables: one character, repeated. */
function rule(char: string, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += char;
  return out;
}

/** Display names for the five criteria, in breakdown order. */
const CRITERION_LABELS: Record<keyof Scores, string> = {
  poignancy: "Poignancy",
  wit: "Wit",
  surprise: "Surprise",
  relatability: "Relatability",
  memorability: "Memorability",
};

/**
 * One criterion row of the breakdown: name, hand grade out of 10,
 * weight, and weighted contribution.
 */
function breakdownRow(
  name: string,
  grade: number,
  weight: number,
  value: number,
): string {
  const label = name.padEnd(13, " ");
  return `  ${label} ${grade}/10  x ${weight.toFixed(2)}  = ${oneDecimal(value)}`;
}

/** A summary row of the breakdown: a label and a single value. */
function summaryRow(label: string, value: string): string {
  return `  ${label.padEnd(13, " ")}            = ${value}`;
}

/**
 * The full score breakdown for the winner: one row per criterion,
 * then the base score, the feature bonus, and the total.
 */
function renderBreakdown(scored: ScoredCandidate): string {
  const s = scored.candidate.scores;
  const c = scored.contributions;
  const lines: string[] = ["Score breakdown:"];
  for (const key of CRITERION_KEYS) {
    lines.push(breakdownRow(CRITERION_LABELS[key], s[key], WEIGHTS[key], c[key]));
  }
  lines.push(summaryRow("Base score", oneDecimal(scored.baseScore)));
  const sign = scored.featureBonus >= 0 ? "+" : "";
  lines.push(summaryRow("Feature bonus", `${sign}${scored.featureBonus}`));
  lines.push(summaryRow("Total", `${oneDecimal(scored.total)} / 100`));
  return lines.join("\n");
}

/** The most characters of a line the ranked table shows. */
const TABLE_LINE_WIDTH = 60;

/**
 * The ranked table: rank, id, total, base, bonus, and the line
 * itself, truncated so the table stays readable.
 */
function renderTable(ranked: ScoredCandidate[]): string {
  const lines: string[] = ["Rank  ID   Total  Base  Bonus  Line", rule("-", 100)];
  ranked.forEach((scored, index) => {
    const rank = String(index + 1).padStart(2, " ");
    const id = scored.candidate.id.padEnd(4, " ");
    const total = fmt(scored.total);
    const base = fmt(scored.baseScore);
    const bonus = (scored.featureBonus >= 0 ? "+" : "") + String(scored.featureBonus);
    const text = scored.candidate.text;
    const shown =
      text.length > TABLE_LINE_WIDTH ? text.slice(0, TABLE_LINE_WIDTH - 3) + "..." : text;
    lines.push(`${rank}.   ${id} ${total} ${base}  ${bonus.padStart(3, " ")}   ${shown}`);
  });
  return lines.join("\n");
}

/** Format a signed bonus the way the --all listing shows it. */
function signedBonus(bonus: number): string {
  return (bonus >= 0 ? "+" : "") + String(bonus);
}

/**
 * Every candidate with its full scores, for --all mode. One block
 * per candidate, in ranked order.
 */
function renderAll(ranked: ScoredCandidate[]): string {
  const blocks = ranked.map((scored, index) => {
    const c = scored.candidate;
    const grades =
      `  P ${c.scores.poignancy}  W ${c.scores.wit}  S ${c.scores.surprise}` +
      `  R ${c.scores.relatability}  M ${c.scores.memorability}` +
      `  |  base ${oneDecimal(scored.baseScore)}  bonus ${signedBonus(scored.featureBonus)}`;
    return [
      `#${index + 1}  ${c.id}  —  total ${oneDecimal(scored.total)} / 100`,
      `  "${c.text}"`,
      `  Voice: ${c.voice}`,
      grades,
    ].join("\n");
  });
  return blocks.join("\n\n");
}

/**
 * The winner as a JSON object, for --json mode. The shape is
 * stable: id, text, voice, total, baseScore, featureBonus, and the
 * five raw grades plus their weighted contributions.
 */
function renderWinnerJson(scored: ScoredCandidate): string {
  const c = scored.candidate;
  const contributions: Record<string, number> = {};
  for (const key of CRITERION_KEYS) {
    contributions[key] = Number(oneDecimal(scored.contributions[key]));
  }
  const payload = {
    id: c.id,
    text: c.text,
    voice: c.voice,
    total: Number(oneDecimal(scored.total)),
    baseScore: Number(oneDecimal(scored.baseScore)),
    featureBonus: scored.featureBonus,
    grades: c.scores,
    contributions,
  };
  return JSON.stringify(payload, null, 2);
}

// ---------------------------------------------------------------------------
// Entry file output
// ---------------------------------------------------------------------------

/**
 * Write the winning line to entry.txt — the file the grader reads.
 *
 * The output directory comes from MAKEFUN_OUTPUT_DIR and falls back
 * to "/output" when the variable is unset, so the entry lands at
 * /output/entry.txt by default. The directory is created if needed.
 * The file holds exactly the winning line, a single line with no
 * trailing newline, and nothing else. After writing, the file is
 * read back and its bytes must equal the winner text exactly;
 * anything else is a failure, not a silent near-miss.
 *
 * Returns the path written. Throws on any failure: empty or
 * multi-line winner text, an unwritable directory, or a read-back
 * that does not match the winner byte for byte.
 */
function writeEntry(winnerText: string): string {
  if (!winnerText || winnerText.trim().length === 0) {
    throw new Error("Winner text is empty; refusing to write entry.txt.");
  }
  if (winnerText.includes("\n") || winnerText.includes("\r")) {
    throw new Error("Winner text is more than one line; refusing to write entry.txt.");
  }

  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const entryPath = join(outputDir, "entry.txt");

  try {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(entryPath, winnerText, "utf8");
  } catch (err) {
    throw new Error(
      `Could not write ${entryPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let readBack: string;
  try {
    readBack = readFileSync(entryPath, "utf8");
  } catch (err) {
    throw new Error(
      `Could not read back ${entryPath} to verify it: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (readBack !== winnerText) {
    throw new Error(
      `Verification failed: ${entryPath} does not match the winning line byte for byte.`,
    );
  }
  // Byte-level check as well: the file must be exactly as many bytes
  // as the winner text and exactly one line. A string comparison
  // alone would not catch a stray trailing newline or a re-encoded
  // byte slipping in through the write.
  const expectedBytes = Buffer.byteLength(winnerText, "utf8");
  const actualBytes = statSync(entryPath).size;
  if (actualBytes !== expectedBytes) {
    throw new Error(
      `Verification failed: ${entryPath} is ${actualBytes} bytes, expected ${expectedBytes} for the winning line.`,
    );
  }
  if (readBack.split("\n").length !== 1) {
    throw new Error(`Verification failed: ${entryPath} is not exactly one line.`);
  }

  return entryPath;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = [
  "Texts From Your Future Self — deterministic one-line picker",
  "",
  "Usage:",
  "  npx tsx main.ts            print the winning line and its breakdown",
  "  npx tsx main.ts --list     print the full ranked table",
  "  npx tsx main.ts --all      print every candidate with its scores",
  "  npx tsx main.ts --json     print the winner as JSON",
  "  npx tsx main.ts --help     print this help",
  "",
  "No network, no randomness: every run prints the same winner.",
].join("\n");

/** The flags the CLI understands, and the mode each one selects. */
const FLAG_MODES: Record<string, "list" | "all" | "json" | "help"> = {
  "--list": "list",
  "--all": "all",
  "--json": "json",
  "--help": "help",
  "-h": "help",
};

type RunMode = "winner" | "list" | "all" | "json" | "help";

/**
 * Parse the command-line flags. Unknown flags are an error: the CLI
 * is small, and silently ignoring a typo would be worse than failing
 * loudly. --help is the only flag that prints usage and exits 0.
 */
function parseArgs(argv: string[]): { mode: RunMode } {
  const flags = argv.slice(2);
  if (flags.length === 0) return { mode: "winner" };
  if (flags.length === 1 && flags[0] in FLAG_MODES) {
    return { mode: FLAG_MODES[flags[0]] };
  }
  throw new Error(`Unknown arguments: ${flags.join(" ")}\n\n${USAGE}`);
}

/**
 * The default output: the winning line, big and first, then the
 * breakdown underneath so the reader can see exactly why it won.
 */
function printWinner(scored: ScoredCandidate): void {
  const c = scored.candidate;
  const voiceSuffix = c.voice.replace(/^You, /, "");
  console.log("TEXTS FROM YOUR FUTURE SELF");
  console.log(rule("=", 100));
  console.log("");
  console.log(`  "${c.text}"`);
  console.log("");
  console.log(`  — you, ${voiceSuffix}`);
  console.log(`  Candidate ${c.id}  |  ${oneDecimal(scored.total)} / 100`);
  console.log("");
  console.log(renderBreakdown(scored));
  console.log("");
  console.log(`Picked from ${CANDIDATES.length} candidates. Deterministic: re-run for the same result.`);
}

/** Print the ranking in the mode the flags asked for. */
function printRanked(mode: RunMode, ranked: ScoredCandidate[]): void {
  const winner = ranked[0];
  const printers: Record<Exclude<RunMode, "winner" | "help">, () => void> = {
    list: () => console.log(renderTable(ranked)),
    all: () => console.log(renderAll(ranked)),
    json: () => console.log(renderWinnerJson(winner)),
  };
  if (mode === "winner") {
    printWinner(winner);
  } else {
    printers[mode]();
  }
}

/** Entry point: validate, rank, write entry.txt, print per the flags. */
function main(): void {
  let mode: RunMode;
  try {
    mode = parseArgs(process.argv).mode;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  try {
    validateCandidates(CANDIDATES);
  } catch (err) {
    console.error(`Invalid candidate set: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const ranked = rankAll(CANDIDATES);
  const winner = ranked[0];

  // Write the entry file on every run mode, before any printing:
  // the grader reads entry.txt, so a --list, --json, --all or even
  // --help run must not leave it missing or stale.
  let entryPath: string;
  try {
    entryPath = writeEntry(winner.candidate.text);
  } catch (err) {
    console.error(`Failed to write entry.txt: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  if (mode === "help") {
    console.log(USAGE);
    console.log("");
    console.log(`Entry written to ${entryPath}`);
    return;
  }

  printRanked(mode, ranked);
  console.log("");
  console.log(`Entry written to ${entryPath}`);
}

main();
