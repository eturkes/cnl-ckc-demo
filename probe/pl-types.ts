export type PrologTermDto =
  | Readonly<{ type: 'atom'; value: string }>
  | Readonly<{ type: 'string'; value: string }>
  | Readonly<{ type: 'integer'; value: string }>
  | Readonly<{ type: 'rational'; numerator: string; denominator: string }>
  | Readonly<{ type: 'float'; value: string }>
  | Readonly<{ type: 'variable'; id: number }>
  | Readonly<{ type: 'compound'; functor: string; args: readonly PrologTermDto[] }>
  | Readonly<{ type: 'list'; items: readonly PrologTermDto[]; tail: PrologTermDto | null }>;

export type PrologSolutionDto = Readonly<{
  term: PrologTermDto;
  canonical: string;
  display: string;
}>;

export type QueryResponseDto =
  | Readonly<{
      requestId: number;
      ok: true;
      solutions: readonly PrologSolutionDto[];
    }>
  | Readonly<{
      requestId: number;
      ok: false;
      error: Readonly<{
        type: 'prolog' | 'serialization' | 'protocol';
        message: string;
      }>;
    }>;

export function termType(term: PrologTermDto): PrologTermDto['type'] {
  switch (term.type) {
    case 'atom':
    case 'string':
    case 'integer':
    case 'rational':
    case 'float':
    case 'variable':
    case 'compound':
    case 'list':
      return term.type;
    default: {
      const unreachable: never = term;
      return unreachable;
    }
  }
}
