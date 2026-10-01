# Visual Upgrade Handoff / 2026-10-01

## Status

The initial code-only pass below is historical. Subsequent validation and
production deployment are recorded in [Visual Release](nightly-visual-release.md).

Code-only visual iteration coordinated by Codex with Claude Code. Changes are
intended for later review, not a tested or deployed release. No tests, builds,
lint, type checking, React Doctor, browsers, app startup, containers, SSH or
production changes were performed during this iteration. Push commits use
`[skip ci]` to avoid starting the existing Battleship deployment workflow.

## Checkpoints Before Design Work

- Minesweeper: `f8fffc8` on `Jair0305/minesweeper-web`.
- Battleship: `0ec74b7` on `Jair0305/battleship`.
- Local databases, private keys, environment files and generated caches are not
  part of the checkpoint. They remain local. Credentials in the newly tracked
  legacy Battleship duplicate config were replaced with environment variables.

## Claude Code Session

- Session: `6ef66e97-3a7f-4c93-b273-8628574e5b52`.
- Name: `Nightly Games coordinated visual upgrade`.
- Working directory: the top-level Minesweeper frontend; additional directory:
  the top-level Battleship frontend.
- Started with restricted/safe mode, no Chrome, strict MCP configuration, and
  only `Read`, `Edit`, `Write`, `Glob`, `Grep`. No terminal or browser tools.
- Full assignment: Minesweeper frontend `docs/nightly-visual-brief.md`.
- Shared specification: `docs/nightly-art-direction.md`, mirrored identically
  in both frontends. Synchronize these copies and core tokens when editing.

## Static Review

| Before | After | Why |
| --- | --- | --- |
| Diverging Nightly tokens and UI treatments | Shared palette, type ramp, surface and motion vocabulary | Both games read as one family |
| Battleship particle RAF and persistent blur | Static sonar backdrop and solid surfaces | Avoid competing with gameplay input |
| Generic transitions, moving cells, perpetual scanline | Explicit control transitions and bounded result motion | Keep hitboxes and normal actions stable |
| Dim secondary labels | Higher-contrast faint token and visible keyboard focus | Improve readability without changing the identity |
| Fabricated asset preview and internal UI copy | Real fleet manifest and game-specific details | Give the art direction meaningful content |
| Battleship errors/shot feedback occupy space above the boards | Non-interactive fixed notification layer | Feedback no longer shifts the game layout |

Backend code, API contracts, dependencies, lockfiles, tests, Minesweeper
`MinefieldBoard`, queue/input/realtime/session hooks and snapshot logic are
unchanged by the visual pass. In mixed UI components, changes are presentation
classes, JSX and renderable outcome labels. Existing role gating and hidden
information stay intact. Entrance transforms return to `none`, and reduced
motion skips the animated presentation.

## Deferred At End Of Code-Only Pass

Compilation, actual viewport layout/contrast, focus behavior, motion perception,
large-board frame/input performance, reconnect, multiplayer and authentication
smokes. These checks are deliberately deferred at the user's request. Do not
interpret this static review as runtime, security or accessibility certification.
