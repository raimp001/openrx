# OpenRx Exa UI benchmark

## Benchmark

Exa's strongest product pattern is not a particular color or animation. It is hierarchy:

1. One dominant search surface.
2. Compact modes beside the query.
3. Quiet navigation that does not compete with the task.
4. Minimal explanation before the user can act.
5. Results and artifacts appear only after the query.

OpenRx already has a stronger trust model for healthcare, but its homepage made the query compete with a large synthetic panel, repeated calls to action, badges, and multiple card grids. The app shell also duplicated Ask, Messages, and Setup across navigation surfaces, while mixed serif and sans typography made pages feel like different products.

## Product direction

OpenRx should use Exa's query-first discipline and add the healthcare capabilities Exa does not need:

- deterministic, version-stamped clinical recommendations;
- visible guideline source, grade, date, and rule identifier;
- explicit missing information;
- care-search, referral, prior-authorization, and appeal actions;
- human review before external clinical action.

## Execution prompt

Benchmark the current OpenRx homepage and chat entry state against Exa Search. Preserve all clinical rules, model boundaries, referral controls, audit behavior, and external-action gates. Make the query the only dominant first-viewport interaction. Provide compact workflow modes for screening, care search, and coverage. Use one sans family across patient and clinician surfaces. Flatten shared headers and page chrome, remove duplicate first-level navigation, reduce rounded containers, and move detailed provenance below the first question. Keep every link and action functional. Verify raw SSR HTML, mobile overflow, keyboard focus, contrast tokens, chat actions, deterministic screening output, build integrity, and the production deployment commit.

## Implemented in this pass

- Replaced the mixed editorial-serif system with Geist Sans throughout the application.
- Rebuilt the homepage around one clinical command surface with screening, care, and coverage modes.
- Flattened the shared app page header and top bar.
- Removed duplicate and low-value first-level sidebar entries.
- Simplified the empty chat state and retained working screening, care-search, and clinician-note actions.
- Preserved the engine-backed synthetic recommendation and exposed provenance and next actions after the primary query.
