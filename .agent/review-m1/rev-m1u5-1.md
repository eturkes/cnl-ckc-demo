# rev-m1u5-1 — adversarial review of M1.u5, accessible question intake

Check set = `.agent/contracts/m1u5-rev-checkset.md` (fixed, 28 rows). Verdict table below;
detail sections keyed by row id. Fill every row IN PLACE; never renumber.
Grade: `python3 -P .scratch/validate-report.py .agent/review-m1/rev-m1u5-1.md --verdict`

| id | finding | evidence |
| --- | --- | --- |
| I01 | pass: host preserves the implicit-listbox combobox relation and label-derived accessible name in closed and open frames | `pnpm exec vitest … rev-m1u5-structure-probe…` 1/1; `src/questions/QuestionCombobox.svelte:180-190` |
| I02 | pass: expanded state tracks hidden, open, commit, cancel and click-toggle transitions with exact string values | structure probe 1/1; `src/questions/QuestionCombobox.svelte:187,204` |
| I03 | fail(low): runtime options follow catalog order, but the suite embeds two generated question sentences as source literals | `tests/question-combobox.dom.test.ts:217,234`; `.agent/review-m1/red-m1u5-i03.test.mjs` rc=1 |
| I04 | pass: each of six controlled selections yields one true and five false attributes; null yields six false attributes | structure probe 1/1; `src/questions/QuestionCombobox.svelte:207-216` |
| I05 | pass: active descendant is valued only while open, disappears when closed, and DOM focus stays on the host | structure probe 1/1; `src/questions/QuestionCombobox.svelte:160-172,188` |
| I06 | pass: controlled text selects catalog copy or the prompt, and the combobox subtree contains no focusable descendant | structure probe 1/1; `src/questions/QuestionCombobox.svelte:191-194` |
| I07 | unknown | unknown |
| I08 | unknown | unknown |
| I09 | unknown | unknown |
| I10 | unknown | unknown |
| I11 | unknown | unknown |
| I12 | unknown | unknown |
| I13 | unknown | unknown |
| I14 | unknown | unknown |
| I15 | unknown | unknown |
| I16 | unknown | unknown |
| I17 | unknown | unknown |
| I18 | unknown | unknown |
| I19 | unknown | unknown |
| I20 | unknown | unknown |
| I21 | unknown | unknown |
| I22 | unknown | unknown |
| I23 | unknown | unknown |
| I24 | unknown | unknown |
| I25 | unknown | unknown |
| I26 | unknown | unknown |
| I27 | unknown | unknown |
| I28 | unknown | unknown |

## Details

### I03

**Ruling:** The rendered option labels come from `QUESTION_CATALOG`, but K5 comments copy the
full `recommendation-exists` and `dosage-reduction-content` questions. This breaches I03's
explicit component-and-suite literal census. Runtime behavior is unchanged, but generated copy
can drift while the suite keeps stale explanatory claims.

**Acceptance:** Replace both sentence literals with catalog-id descriptions. Then
`node --test .agent/review-m1/red-m1u5-i03.test.mjs` must return rc=0.

## Register

None.
