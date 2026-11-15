# ASTRA · Astronaut Health Monitor

A NASA-inspired mission dashboard for one fictional astronaut. Built with HTML, CSS, vanilla JavaScript and original bundled SVG illustrations. No dependencies, account, backend, API keys, or build step are required.

## Run locally

From the repository directory:

```sh
python3 -m http.server 8000
```

On Windows, use `python -m http.server 8000` if `python3` is unavailable. Open **http://localhost:8000**. Use an HTTP server rather than opening `index.html` directly, because the app uses JavaScript modules.

## What works

- Six indicators: sleep duration, resting heart rate, mood, blood pressure, body temperature, and blood glucose.
- Mission day 8 starts empty; seven fixed fictional days populate all charts. Use the day arrows or enter a day from 1–9999 to navigate and edit.
- Partial check-ins store missing measurements as `null`. At least one reading is required. Pressure needs both values; sleep allows 0–24 hours, mood allows integers 1–5, and heart rate, pressure, and glucose must be positive finite numbers. These are input checks, not clinical ranges.
- Saving replaces the selected day's record, updates the cards and chart, and confirms success. Fields load saved values when revisiting a day.
- Select any metric card to switch the chart. Blood pressure has separately labeled systolic and diastolic series. Missing readings leave gaps. A disclosure below the chart exposes a readable data table. Range choices show up to 7, 14, or 30 days ending on the selected day.
- Data and selected day persist under the project-specific `astra.crew-health.v1` localStorage key. Storage failures are reported; failed saves do not update the saved dashboard. Saved data is checked before use. Data stays in the browser, and is not synchronized between devices or browser profiles.
- **Reset demo** asks before clearing this app's storage, then restores day 8 and the original seven-day fixture. It does not clear other websites' storage.
- Responsive layouts, labeled inputs, keyboard-operated controls, visible focus, text alongside status colors, and a reduced-motion preference.

## Sleep demonstration rule

The fixed baseline is the median of the original seven sleep values: **7, 7.5, 6.5, 7, 7.25, 6.75, 7** hours. The median is **7 hours**, even if a seeded day is edited.

For the selected day and immediately preceding mission day, two sleep readings of **6 hours or less** produce **Review sleep trend**. The panel names both nights and their values, shows the baseline, and prompts the user to confirm entries and note schedule changes. If a reading is absent, it identifies the missing day; otherwise it shows **Logged**. On day 1, the first available reading is logged without a two-night comparison. The other five metrics use **Logged** or **Missing reading**, without diagnostic alerts.

This threshold is a product demonstration rule supplied in the brief. It is not a NASA clinical protocol or medical advice. All readings, the astronaut, mission identity, and illustrations are fictional; this project is independent and not affiliated with NASA.

## Two-minute demo

1. Start fresh, or choose **Reset demo** and confirm. Day 8 shows **Check-in due**.
2. Scroll to **Daily check-in**. Enter sleep `5`, heart rate `68`, mood `3 · Neutral`, temperature `36.7`, pressure `118 / 76`, and glucose `90`. Save. Day 8 shows `5 hours` and **Logged**.
3. Refresh. Confirm that day 8 and its readings remain. Select **Blood pressure** to see both series, and expand the readings table.
4. Choose **Next mission day** to reach day 9. Save sleep `5.5`. Select **Sleep duration**. The dashboard shows **Review sleep trend**, both nights, and the 7-hour baseline.
5. For a gap example, reset, advance to day 10 without saving day 9, and save sleep `6`. The chart leaves day 9 blank and the sleep panel names day 9 as missing. Edit days 9 and 10 to `6`; day 10 then flags.
6. Verify sleep `0` saves and `25` produces an inline error. Enter a lone pressure value to see the paired-reading error. Reset when finished.

## Verification

With Node.js 18+ installed:

```sh
node --test
node --check app.js
node --check health.js
git diff --check
```

The dependency-free test suite covers baseline integrity, consecutive-day alerts, exact thresholds, missing days, zero sleep, partial entries, invalid numbers, paired pressure, edits, reset state, persistence round-trips, corrupt stored data, and mission-day limits.

## GitHub Pages

All assets use relative paths. To host on GitHub Pages, select **Settings → Pages → Deploy from a branch → main → / (root)** in this repository. No build configuration is needed. Pushing the source to GitHub alone does not enable Pages.

## Files

- `index.html`, `styles.css`: responsive dashboard, check-in form, and mission theme.
- `app.js`: browser storage, navigation, input feedback, SVG charts, and rendering.
- `health.js`: metric definitions, validation, saved-state parsing, and pure sleep evaluation.
- `demo-data.js`: immutable fictional seven-day fixture.
- `assets/`: original ASTRA emblem, mission patch, and orbital illustration; no external images, fonts, or tracking.
- `tests/health.test.js`: logic and persistence-format regression tests.

## Source credits

Spaceflight research provides the project context; none of the bundled readings come from real crew health records.

- [NASA Human Research Program — Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/).
- [NASA Technical Reports Server — Astronaut Sleep Duration Varies by Timing of Scheduled Sleep](https://ntrs.nasa.gov/citations/20230003916), Flynn-Evans, Glaros, and Jansen, 2023. Research context for sleep and scheduling; it does not establish this app's threshold.
- User-provided **Astronaut Health Monitor** product brief: MVP behavior, fixed baseline, and demonstration rule.
