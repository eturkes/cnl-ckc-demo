// PROTOTYPE: the three display premises under comparison, picked by `?variant=`.

export const VARIANTS = ['facts', 'inline', 'graded'] as const;

export type Variant = (typeof VARIANTS)[number];

export const VARIANT_NAMES: Record<Variant, string> = {
  facts: 'A — facts under each statement',
  inline: 'B — marks inside the sentence',
  graded: 'C — grouped by grade',
};

export const variantFromUrl = (href: string): Variant => {
  const value = new URL(href).searchParams.get('variant');
  return (VARIANTS as readonly string[]).includes(value ?? '') ? (value as Variant) : 'facts';
};

export const urlForVariant = (href: string, variant: Variant): string => {
  const url = new URL(href);
  url.searchParams.set('variant', variant);
  return url.toString();
};
