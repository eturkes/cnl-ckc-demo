// GUIDELINE and FONT_LICENCES are locale-invariant reference data, not prose.

export const GUIDELINE = {
  title: 'CDC Clinical Practice Guideline for Prescribing Opioids for Pain — United States, 2022',
  html: 'https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm',
} as const;

/** Font licence files, copied verbatim from each package and served from `dist/`. */
export const FONT_LICENCES = [
  { family: 'Atkinson Hyperlegible Next', href: 'licenses/atkinson-hyperlegible-next.txt' },
  { family: 'Atkinson Hyperlegible Mono', href: 'licenses/atkinson-hyperlegible-mono.txt' },
  { family: 'Literata', href: 'licenses/literata.txt' },
  { family: 'BIZ UDPGothic', href: 'licenses/biz-udpgothic.txt' },
] as const;
