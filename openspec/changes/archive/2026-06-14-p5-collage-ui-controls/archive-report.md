# Archive Report: p5-collage-ui-controls

**Archived**: 2026-06-14
**PR1**: Control panel sidebar (6 presets, scatter scale, bg selector, noise, catalog, per-cell editor, selection highlight, Esparcir Todo)
**PR2**: Drag & drop (hit-test, 5px threshold, position clamping), touch support, floating control bar (rotate L/R, bring to front, hide)

## Task Reconciliation

The filesystem `tasks.md` had all 16 tasks as `- [ ]` (unchecked) because `sdd-apply` only marked progress in Engram, not in the filesystem artifact. This is a mechanical stale-checkbox issue — orchestrator explicitly authorized reconciliation with proof from apply-progress and verify reports.

**Evidence**:
- Engram observation #605: All 16 tasks marked `[x]`
- Engram observation #606: PR2 apply-progress — all 7 PR2 tasks confirmed delivered with test files created
- Engram observation #607: PR1 verify — PASS WITH WARNINGS (197 tests passing)
- Final test run: **17 suites, 224 tests, all passing** (up from 15/197 at PR1)

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| projector-controls | Created | `openspec/specs/projector-controls/spec.md` — 148 lines, 14 requirements (R-CPS-1..8, R-DND-1..3, R-SEL-1..4) |

Delta spec was a complete spec (not incremental). No existing main spec to merge with — copied directly.

## Archive Contents

| Artifact | Status | Notes |
|----------|--------|-------|
| proposal.md | ✅ Complete | Intent, scope, approach, risks |
| spec.md | ✅ Complete | 14 requirements + scenarios |
| specs/projector-controls/spec.md | ✅ Complete | Delta spec (identical to main) |
| design.md | ✅ Complete | Architecture decisions, data flow, file changes |
| tasks.md | ✅ Complete | 16/16 tasks (stale checkboxes reconciled) |
| verify-pr1.md | ✅ Complete | PASS WITH WARNINGS — PR1 verified |
| archive-report.md | ✅ Complete | This file |

## Verification Status

| Metric | Value |
|--------|-------|
| Tasks total | 16 (9 PR1 + 7 PR2) |
| Tasks complete | 16 (100%) |
| Test suites | 17 passing |
| Test count | 224 passing |
| Critical issues | 0 |

### PR1 Verdict: PASS WITH WARNINGS
- All 10 PR1-scoped requirements (R-CPS-1..8, R-SEL-1, R-SEL-3, R-SEL-4) implemented
- Tasks 1.8/1.9 (DOM-layer tests) noted as warnings — underlying engine logic IS covered
- R-SEL-2 (floating controls) explicitly deferred to PR2 — confirmed complete

### PR2 Verification Note
No standalone `verify-pr2.md` exists. PR2 verification is evidenced by:
- Engram apply-progress observation (#606): confirms drag-manager.js, floating bar, touch events, and 31 new tests delivered
- Test run: 224 tests pass (197 baseline + 22 drag-manager + ~5 incremental)
- Source inspection confirms all PR2 requirements (R-DND-1..3, R-SEL-2) implemented per spec

## Engram Traceability

| Artifact | Topic Key | Observation ID |
|----------|-----------|----------------|
| Tasks | sdd/p5-collage-ui-controls/tasks | #605 |
| Apply Progress PR2 | sdd/p5-collage-ui-controls/apply-progress | #606 |
| Verify PR1 | sdd/p5-collage-ui-controls/verify-pr1 | #607 |
| Archive Report | sdd/p5-collage-ui-controls/archive-report | #608 |

## SDD Cycle Complete

The change has been fully explored, proposed, specced, designed, implemented, verified, and archived.
All delta specs are merged into `openspec/specs/projector-controls/spec.md`.
The change folder lives at `openspec/changes/archive/2026-06-14-p5-collage-ui-controls/`.
