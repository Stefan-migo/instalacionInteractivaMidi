# Archive Report — phone-client-controls-revamp

Archived: 2026-11-05
Change folder: `openspec/changes/archive/2026-11-05-phone-client-controls-revamp/`

## Verification at archive time

- Tasks: 16/16 checked in `tasks.md`.
- Protocol is implemented, not only specified:
  - `bridge/message-relay.js` — `VALID_ACTIONS` carries `opacity`, `rotation`, `filter`, `move`, `scale`, `border-next`, `filter-next`; `FILTER_NAMES` and `VALID_VALUE_ACTIONS` define the accepted domains; `formatActionMessage` spreads `value`/`dx`/`dy`.
  - `bridge/index.js` forwards the full payload to `formatActionMessage`.
  - `p5-collage/device-manager.js` passes the payload through `handleAction`, and `p5-collage/sketch.js` clamps opacity, rotation and position.
- `tests/message-relay.test.js` and `tests/device-manager.test.js` cover the value actions.
- Suite: 311 tests passing across 20 suites.

## Notes

- Only `verify-pr1.md` was written during the change. PR2 verification was covered by the device-manager and renderer tests added with the implementation.
- The delta specs were never merged into `openspec/specs/`. The behaviors they describe are already present in `projector-controls`, `phone-ux` and `phone-style`; this archive is kept as the historical record instead of being re-merged during the repository neutralization.
- The proposal and design documents still describe the original subject matter of the installation. They are historical records and are intentionally left as written.
