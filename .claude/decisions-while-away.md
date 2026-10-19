# Decisions log — orchestrator autonomy audit trail

Every decision the orchestrator makes autonomously (under the four gates in user-global
§ "Orchestrator autonomy": reversible, foundation-citable, not on the never-auto-decide list, logged
BEFORE execution) is recorded here. Thomas reviews on return and marks each entry `accepted` or
`reversed`. Calibration target: **5–10% reversal rate**.

Filename retained for path stability with the historic logs and the user-global rule that names it.

**This file stays small.** Per `CLAUDE.md § Coordination docs stay small`: once entries are reviewed
and the calibration signal is taken, archive them under `.claude/log/` rather than letting the file
accrete. If it passes ~10 KB, archive the reviewed entries.

> **History:** every decision logged through 2026-08-02 is archived at
> [`.claude/log/decisions-while-away-archive-2026-08-02.md`](log/decisions-while-away-archive-2026-08-02.md)
> (78 KB). That archive is read-only history; do not append to it.

## Entry schema

```
## YYYY-MM-DD HHMM UTC — <one-line headline>
- **Decided:** <what was done, concrete and specific>
- **Foundation:** <cited memory name / doc section + path / prior-session precedent>
- **Alternative:** <what surfacing would have produced as the other option>
- **Reversibility:** <how to undo + estimated effort>
- **Status:** accepted 2026-10-19 (Thomas took Kevin's scene picks, incl. sheep-2 v3 from this retake) | accepted | reversed by <user> <date>
```

## Entries

## 2026-10-18 2042 UTC — sheep-2 scene: one sharpened second round (--force adds v3-v4)

- **Decided:** told the TOOLS worker (ctx_1935e3e150fe) to run `generatePackPictures.ts --scenes --words sheep-2 --force` once, after sharpening the sheep-2 subject so the harp stands visibly inside the open barn doorway. Est. $0.1435; wave 4 picture spend goes $2.4313 -> ~$2.57.
- **Foundation:** content-wave-4.md § 9.2 + § 9 (a visibly-off scene gets one second round; second rounds expected) and T4 (Thomas approved up to $3.50 on 2026-10-18). Verified on the sheet: neither sheep-2 variant shows a harp, and harp is the story's answer ("A harp is in the barn."). `--force` only adds v3-v4, overwrites nothing.
- **Alternative:** ship sheep-2 on the answer-picture fallback, or wait for Thomas.
- **Reversibility:** Thomas picks any variant (v1-v4) or none; the subject edit is one manifest line.
- **Status:** accepted 2026-10-19 (Thomas took Kevin's scene picks, incl. sheep-2 v3 from this retake)
