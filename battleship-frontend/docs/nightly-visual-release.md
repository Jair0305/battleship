# Nightly Visual Release / 2026-10-01

## Reviewed And Published

- Production: https://battleship.nightly.mx
- Frontend image: `ghcr.io/jair0305/battleship-frontend:af4f477`.
- Host: existing `nightly-int`; only `battleship-frontend` was replaced.
- Backend remains `c80b74a6194e1b014c314c53f041ff41370d6bcd`; database unchanged.
- Existing container Nginx was syntax-checked and gracefully reloaded to resolve
  the replacement frontend. Host/container Nginx files were not modified.
- Image built locally from a clean Git archive, transferred with SHA256
  verification, and loaded manually. No Actions runner or GHCR push was used.
- Audit and rollback environment: `/opt/battleship/backups/visual-af4f477`.
  The reviewed operator script is retained there as `release.sh`.
- Inventory comparison: all 21 other containers, including stopped containers,
  retained their IDs, images, status, start time and restart count. All previous
  image IDs were retained. No global cleanup or other service restart occurred.

## Corrections During Review

- Next and its ESLint config updated to 16.3.8; Axios updated to 1.20.0.
  Compatible lockfile patches also removed development dependency advisories.
  `npm audit` reports zero known vulnerabilities, not a full security guarantee.
- Constrained grid columns and panels to prevent page clipping on mobile.
- Square board cells now fit available desktop width, with scrolling confined
  to a board on small screens. Mouse/input handlers and backend rules unchanged.
- Shared Nightly art-direction tokens remain aligned with Minesweeper.

Security references: [Next ImageResponse advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j),
[Axios advisory](https://github.com/advisories/GHSA-mghh-pgcx-3jjj).
These were dependency findings; no exploitation was established in this app.

## Evidence And Limits

- Lint, `tsc --noEmit --incremental false`, build, Docker build and Maven package
  passed. Existing backend suite contains one context test; it is not complete
  gameplay unit coverage.
- Local and production Playwright operator smoke: two players and a spectator,
  login/register layouts, guest entry, lobby, empty table, both seats, ready,
  manual placement/rotation, random placement, shot, stable board position,
  single chat delivery to all three sessions, victory, rematch and leave.
- Viewports 390/768/1024/1440 checked; frame bounds checked as well as document
  width, to detect clipping hidden by the outer overflow rule. Spectator ships
  stay hidden during play; column 10 is reachable by board-only scroll.
- Reduced motion checked locally. The animated result is finite; the backdrop
  is static, with no continuous canvas/RAF loop.
- React Doctor changed-scope against checkpoint: 72/100, unchanged after fixes;
  two component-complexity and two existing history/chat index-key warnings.
  They remain documented, not suppressed. Smoke is an external operator script,
  not yet a maintained Battleship Playwright suite.
