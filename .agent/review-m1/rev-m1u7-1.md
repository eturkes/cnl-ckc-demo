# rev-m1u7-1 — adversarial review of M1.u7, demo presentation + honest framing

Check set = `.agent/contracts/m1u7-rev-checkset.md` (fixed, 26 rows). Verdict table below; detail sections keyed by row id.
Fill every row IN PLACE; never renumber.
Grade: `python3 -P .scratch/validate-report.py .agent/review-m1/rev-m1u7-1.md --verdict`

| id | finding | evidence |
| --- | --- | --- |
| U7-01 | pass: All three font packages are exact 5.3.0 pins; source and built scans found no remote font fetch marker. | `package.json`; `src/app.css`; `dist/` |
| U7-02 | pass: The clean generated build contains exactly six woff2 files, 176732 bytes total, and no other font format. | `pnpm kb:build && pnpm build`; `dist/assets/` |
| U7-03 | pass: Six faces omit the Variable suffix, and all three role tokens retain named system and generic fallback stacks. | `src/app.css` |
| U7-04 | pass: Each of six face rules declares swap and one of the paired latin or latin-ext ranges, with no other subset source. | `src/app.css` |
| U7-05 | unknown | unknown |
| U7-06 | unknown | unknown |
| U7-07 | unknown | unknown |
| U7-08 | unknown | unknown |
| U7-09 | unknown | unknown |
| U7-10 | unknown | unknown |
| U7-11 | unknown | unknown |
| U7-12 | unknown | unknown |
| U7-13 | unknown | unknown |
| U7-14 | unknown | unknown |
| U7-15 | unknown | unknown |
| U7-16 | unknown | unknown |
| U7-17 | unknown | unknown |
| U7-18 | unknown | unknown |
| U7-19 | unknown | unknown |
| U7-20 | unknown | unknown |
| U7-21 | unknown | unknown |
| U7-22 | unknown | unknown |
| U7-23 | unknown | unknown |
| U7-24 | unknown | unknown |
| U7-25 | unknown | unknown |
| U7-26 | unknown | unknown |

### U7-01

Checked the three dependency pins and scanned `index.html`, `src/**`, and built `dist/**` for `@import`, scheme-bearing `url(...)`, and Google font hosts. `package.json` pins all three packages to literal `5.3.0`; the Python byte/text scan reported `remote_font_markers 0`. Local package URLs in `src/app.css` are the only font sources.

Command: `pnpm kb:build && pnpm build`, followed by the documented Python source/build scan. Observed: build rc 0 after generation; zero remote font markers.

### U7-02

Built from the worktree after generating its absent `kb/generated` inputs, then censused `.woff2`, `.woff`, `.ttf`, `.otf`, and `.eot` recursively. The census reported six files and 176732 bytes: 10740, 17752, 19092, 33996, 42656, and 52496 bytes; every file was `.woff2` under `dist/assets/`.

Command: `pnpm kb:build && pnpm build`, then the Python font-extension census. Observed: build rc 0; `fonts 6 bytes 176732`; zero other font formats.

### U7-03

Read all six `@font-face` blocks and the three root font tokens in `src/app.css`. Families are `Atkinson Hyperlegible Next`, `Atkinson Hyperlegible Mono`, and `Literata`, with no `Variable` suffix. `--font-ui`, `--font-prose`, and `--font-code` select the required family and retain explicit system-family plus generic fallbacks.

Command: the Python face enumerator plus direct `src/app.css` inspection. Observed: six `variable-suffix=False` results and complete fallback tails for all three tokens.

### U7-04

Enumerated all six face blocks. Every block contains `font-display: swap` and `unicode-range`; each family has exactly one latin source and one latin-ext source, and the declared ranges match those two subsets only.

Command: the Python `@font-face` block enumerator. Observed: `font_face_blocks 6`; all six `swap=True` and `range=True`; three latin and three latin-ext sources.

### U7-05

unknown

### U7-06

unknown

### U7-07

unknown

### U7-08

unknown

### U7-09

unknown

### U7-10

unknown

### U7-11

unknown

### U7-12

unknown

### U7-13

unknown

### U7-14

unknown

### U7-15

unknown

### U7-16

unknown

### U7-17

unknown

### U7-18

unknown

### U7-19

unknown

### U7-20

unknown

### U7-21

unknown

### U7-22

unknown

### U7-23

unknown

### U7-24

unknown

### U7-25

unknown

### U7-26

unknown
