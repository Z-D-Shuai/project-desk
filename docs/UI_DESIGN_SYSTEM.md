# PROJECT DESK · Cream Studio Design System

Current version v1.0.0, Phase 8.2, 2026-11-18; the visual baseline remains v0.7.2 / Phase 7.2. Applies to the existing Node / native modules / SQLite desktop workbench.

Phase 8.2 only fixes theme control state: after a successful save from the top bar to Light / Dark / Follow System, the settings page selection is synchronised; on failure the saved value is restored. A pure system light/dark appearance change never overwrites an unsaved form draft. The Canvas day/night rendering, dot matrix, dragging/spring behaviour and all CSS files are unchanged. Unit and settings-page rendering regressions pass; the real browser run for this round could not start due to Playwright EPERM, so historical screenshots cannot substitute for the final UI acceptance of v1.0.0.

## Basis and trade-offs

Read the root AGENTS.md, the project-specific project-desk-ui Skill and all six specification documents, the UI Kit MASTER and page plans, the original "Light-dark slider — fixed version.html", the reference archive documentation and keyframe overview, combined with the user-provided warm beige workbench image. T1/T3, S1/S3, Q1/Q2, M3, P2/P3, R3, C1/C2, D1/D3, H1/H2 and V1/V2 are all implemented from the saved specifications rather than re-guessed scheme numbers.

The style is Cream Studio + Refined Editorial + Soft Neumorphism. The cream palette, soft shadows and original slider glow explicitly chosen by the user take precedence over prohibitions in generic design skills. These effects are used only for the slider, selected controls, overlays and subtle interactions — never turning every content panel into inflated neumorphism.

## Tokens and compatibility layer

Primary definitions live in `public/styles/tokens.css`, derived from the UI Kit semantic palette; legacy `--ground` / `--surface` / `--ink` map onto `--pd-*` so legacy features reuse the same theme. Phase 7 base components are kept compatible by `studio.css`, while Phase 7.2 materials, shell and project cards are calibrated centrally in `alignment.css`; the final tokens are those in `alignment.css`. Page and component layout is consolidated by both files, with the remaining original page styles retained as a compatibility base.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | #F7F2EB | #24221F |
| Surface | #FCF7F0 | #2D2A26 |
| Raised / Muted surface (--raised) | #EEE5D9 | #34302A |
| Inset | #E7D8C4 | #1D1B18 |
| Primary text | #26251F | #EFE7DA |
| Secondary text | #6F6A61 | #C4B8A6 |
| Border | #E2D9CE | #48423A |
| Control border | #CEC4B7 | #63594B |
| Accent | #A49379 | #B8A58A |
| Success | #8E9F6C | #A8B782 |

Typography uses the Windows system UI font; Georgia is reserved for the brand and totals, while Chinese headings use a clear system sans. Primary heading 34px (28px on narrow screens); project card title 22px (21px narrow); actions and body 14–16px; desktop update time 14px, navigation 20px; secondary metadata at least 11px. Numbers use `tabular-nums`. Colour never replaces status text.

Spacing uses 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40; standard controls 10px radius, panels 14–16px, overlays 18px. Paper surfaces are distinguished by fine strokes and soft ambient shadow, with project/material cards using a double-layer soft shadow; selected states and inputs use moderate inset. The dark theme uses warm-black shadows and low-intensity warm light independently rather than inverting the whole palette.

Motion tokens: fast 140ms, base 180ms, panel 220ms; ease-out `cubic-bezier(.23,1,.32,1)`, ease-in-out `cubic-bezier(.77,0,.175,1)`, drawer `cubic-bezier(.32,.72,0,1)`. Common navigation stays instant, cards lift only 3px, and the keyboard command palette opens without delay.

## Shared components and states

- **Button**: static fine border, surface change on hover, slight inset on press, focus-visible outer ring, reduced emphasis when disabled; primary uses a warm stone background with dark text to avoid insufficient contrast from white text on light beige.
- **Input / Select**: shared borders, 40px base height, native input and dropdown semantics preserved; form errors reuse the original component and original controls are disabled while saving.
- **Project Card**: a same-origin Progress Ring on the left; on the right the name, category and status, real current work (description when no memo exists) and development record count; below, the update time, an independent detail entry and a pin button. The card body is a link, the pin is a separate button that does not trigger navigation. The list view keeps the original list semantics.
- **Progress Ring**: driven solely by the real `progress` value, round line caps, green when in progress, blue-grey when paused, light purple when complete, terracotta grey when abandoned; 0% shows no cap residue. After a successful save the new state is re-read rather than faking success with an animation. Manual progress stays independent of project status.
- **Tabs / Badges**: horizontal text plus counts with a soft inset capsule for the selected state; view switching uses raised/inset; status dots accompany text.
- **Dropdown / Dialog / Side Panel**: a compact quick menu expands into a full two-column panel; the existing native `dialog` provides modal focus, Esc to close and focus return, the drawer keeps the original layout, and overlays share one material.
- **Command Palette**: `Ctrl+K`, ↑↓ to select, Enter to run, Esc to close; live search reuses the unified API with cancellation and stale-response protection.
- **Empty / Loading / Error**: only real states are presented, retaining connecting, loading, retry and empty category/project/material explanations. Success feedback shows an SVG tick and a brief confirmation only after the original save function returns successfully — never on failure.
- **Tooltip**: prefer explicit visible text and `aria-label`; icon and directional buttons carry accessible names rather than relying on floating hints to convey the action.

## Porting the original day/night slider

`public/ui/day-night.js` is ported directly from the drawing and interaction script in the user's HTML — no iframe, full-page embed or ordinary sun/moon icon substitute.

Original geometry coordinates, frosted-glass gradients and noise, the shared rounded dot matrix and paired trajectories for crescent and sun, OKLab multi-stop palette, warm/cool rim light, pointer capture, 110ms velocity sampling, 0.06 inertia prediction, critically damped spring with w=10, and arrow-key/Home/End/Space/Enter behaviour are all preserved. Moved to the top bar: the compact state manipulates the same Canvas (scale .30), and the expanded state moves the same stage into an overlay (max scale .516); the summary uses a cleared-and-redrawn canvas mirror. There is no second animation engine. A click inverts Light/Dark directly; only dragging uses position and inertia to pick a target, and the separate arrow on the right expands the options.

Adaptations: drawing is scoped to the component root; full-page background writes become theme-preview callbacks; mode selection saves through the original settings API; Follow System uses the original system listener; on first theme restore the thumb lands directly on the endpoint to avoid startup flicker. The background interpolates continuously while dragging; for mid-tone readability, background layers are temporarily merged and black/white text is chosen, restoring the full designed palette at the endpoints. The original component's internal drawing is unaffected by this contrast protection.

Animation accumulates full frame intervals from `requestAnimationFrame` timestamps so drawing time is not excluded (which would slow the spring); unchanged page colours are not rewritten. Night flicker timing stops when the panel closes or the tab is backgrounded; closing the panel does not destroy the component and route changes do not reinstall listeners. With reduced motion, positional transitions are removed and snapping is immediate, preserving the end state and semantic feedback.

## Page composition

- **Overview**: utility + editorial header; total project count dominates; focus projects and recent projects have size hierarchy; recent count 1–12; development records grouped by local date with development/materials side by side at roughly 65/35; material type quick entries; real due summaries with direct handling.
- **Project Archive**: cards first, list supported and remembered; at 1536×1024 a 256px sidebar, 78px top bar, 26px main padding, 20px card gap, three columns of roughly 396×236px cards and a 104px ring; category/archive/sort shown directly, advanced name search expanded on demand; status navigation counts update with combined filters and filters can be cleared individually; update time descending by default, creation-time sort retained, with frontend sorting added for existing name/completion fields.
- **Project Detail**: section index + adaptive two-column content, with memo and timeline keeping full width; all existing operations and associations retained.
- **Revisit**: four real overview figures + a directly actionable list + handling history; no fabricated calendar.
- **Resources**: type navigation, combined filters, image/local video preview, category icons, project association counts and local status; web videos never fetch remote thumbnails.
- **Follow-up**: current work and development history sections; existing AI/Agent, project/date filters, log editing and project jumps retained.
- **Settings**: unified grouped navigation for appearance / usage statistics / presets / storage / reminders / backup.

Fixed sidebar on desktop with independent main-area scrolling; the sidebar is kept above 761px and becomes a compact top bar below 760px. Forms, overlays, status navigation and material type navigation adapt to window width; the body must never extend indefinitely or overflow horizontally.

## Data boundaries

No database migrations, backend service/SQL/API changes, no new task system, priority or business stage models, and no fabricated task numerators/denominators. Cards display existing real fields; custom project marks reuse existing category icons/images. Any future independent project mark/stage/task would require a separately designed business model.

The theme remains stored in SQLite. Card/list mode, per-project pinning and recent-item count are browser UI preferences stored in `localStorage` partitioned by actual database path; they never modify business update times or reminders and are not included in existing SQLite backups. Changing browsers or clearing site data resets these UI preferences.

## Phase 7.2 reference alignment and acceptance

The user's warm beige workbench is the primary visual standard; the older dark/light screenshots are used to identify cramped layout, undersized type, card proportions and insufficient material. Paper grain is in `public/assets/paper.svg`; the generated low-contrast ink landscape is in `public/assets/studio-landscape.png`, decorative only and loaded offline, with separate blend and opacity in dark mode. Sample projects from the reference images must never be written into the production SQLite database.

Desktop status navigation and three-column card slots are preserved when few projects exist; two columns at ≤1100px, one column at ≤1000px depending on available main-area width, and compact navigation at ≤760px. Native form semantics, focus-visible, independent pinning and detail links are retained. Browsing statistics remain independent of project development update times.

The existing model has no priority/business stage/total task count, so no fabricated fields are shown; filtering uses category, archive and sort, and the information row uses current work and development records. Reports and galleries label isolated acceptance content truthfully.

Real browser primary viewport 1536×1024 plus 1280/1024/768/390; final inspection reported 0 FAIL / 0 WARN. The user-specified cream / Soft UI / ambient shadow / glow and mask gradient are explicit exceptions, and the inspection parameters `palette-cream, button-fx, heavy-shadow, gradient` are retained. Remaining lint items concern date zero-padding and material shadow hints and are not business faults. See `docs/PHASE72_REPORT.md` for screenshots and evidence.
