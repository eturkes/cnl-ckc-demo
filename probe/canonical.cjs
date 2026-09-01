class CanonicalParser {
  constructor(source) {
    this.source = source;
    this.offset = 0;
    this.variables = new Map();
    this.nextVariable = 0;
  }

  parse() {
    const term = this.parseTerm();
    this.skipSpace();
    if (this.offset !== this.source.length) this.fail('trailing input');
    return term;
  }

  parseTerm() {
    this.skipSpace();
    const char = this.source[this.offset];
    if (char === '[') return this.parseList();
    if (char === '"') return { type: 'string', value: this.parseQuoted('"') };
    if (char === "'") return this.parseAtomOrCompound(this.parseQuoted("'"));
    if (char && /[A-Z_]/.test(char)) return this.parseVariable();

    const number = this.parseNumber();
    if (number) return number;
    return this.parseAtomOrCompound(this.parseBareAtom());
  }

  parseNumber() {
    const match = this.source
      .slice(this.offset)
      .match(/^[+-]?(?:(\d+)r([+-]?\d+)|(\d+\.\d*(?:[eE][+-]?\d+)?)|(\d+[eE][+-]?\d+)|(\d+))/);
    if (!match) return null;
    const end = this.offset + match[0].length;
    if (/[A-Za-z0-9_$]/.test(this.source[end] ?? '')) return null;
    this.offset = end;
    if (match[1] !== undefined) {
      const sign = match[0].startsWith('-') ? '-' : '';
      return { type: 'rational', numerator: `${sign}${match[1]}`, denominator: match[2] };
    }
    if (match[2] !== undefined || match[3] !== undefined) return { type: 'float', value: match[0] };
    return { type: 'integer', value: match[0] };
  }

  parseVariable() {
    const match = this.source.slice(this.offset).match(/^[A-Z_][A-Za-z0-9_]*/);
    if (!match) this.fail('invalid variable');
    this.offset += match[0].length;
    const name = match[0];
    if (name === '_') return { type: 'variable', id: this.nextVariable++ };
    if (!this.variables.has(name)) this.variables.set(name, this.nextVariable++);
    return { type: 'variable', id: this.variables.get(name) };
  }

  parseAtomOrCompound(value) {
    this.skipSpace();
    if (this.source[this.offset] !== '(') return { type: 'atom', value };
    this.offset += 1;
    const args = [];
    this.skipSpace();
    if (this.source[this.offset] === ')') this.fail('zero-arity compound');
    for (;;) {
      args.push(this.parseTerm());
      this.skipSpace();
      const separator = this.source[this.offset++];
      if (separator === ')') break;
      if (separator !== ',') this.fail("expected ',' or ')'");
    }
    return { type: 'compound', functor: value, args };
  }

  parseList() {
    this.offset += 1;
    const items = [];
    let tail = null;
    this.skipSpace();
    if (this.source[this.offset] === ']') {
      this.offset += 1;
      return { type: 'list', items, tail };
    }
    for (;;) {
      items.push(this.parseTerm());
      this.skipSpace();
      const separator = this.source[this.offset++];
      if (separator === ']') break;
      if (separator === '|') {
        tail = this.parseTerm();
        this.skipSpace();
        if (this.source[this.offset++] !== ']') this.fail("expected ']' after list tail");
        break;
      }
      if (separator !== ',') this.fail("expected ',', '|' or ']'");
    }
    return { type: 'list', items, tail };
  }

  parseBareAtom() {
    const start = this.offset;
    while (this.offset < this.source.length && !/[\s,()[\]|]/.test(this.source[this.offset])) {
      this.offset += 1;
    }
    if (this.offset === start) this.fail('expected term');
    return this.source.slice(start, this.offset);
  }

  parseQuoted(quote) {
    this.offset += 1;
    let value = '';
    while (this.offset < this.source.length) {
      const char = this.source[this.offset++];
      if (char === quote) {
        if (this.source[this.offset] === quote) {
          value += quote;
          this.offset += 1;
          continue;
        }
        return value;
      }
      if (char !== '\\') {
        value += char;
        continue;
      }
      value += this.parseEscape();
    }
    this.fail('unterminated quoted text');
  }

  parseEscape() {
    const escape = this.source[this.offset++];
    const named = { a: '\x07', b: '\b', e: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };
    if (escape in named) return named[escape];
    if (escape === '\n') return '';
    if (escape === 'x') {
      const end = this.source.indexOf('\\', this.offset);
      if (end < 0) this.fail('unterminated hexadecimal escape');
      const value = String.fromCodePoint(Number.parseInt(this.source.slice(this.offset, end), 16));
      this.offset = end + 1;
      return value;
    }
    if (escape === 'u' || escape === 'U') {
      const width = escape === 'u' ? 4 : 8;
      const value = String.fromCodePoint(
        Number.parseInt(this.source.slice(this.offset, this.offset + width), 16),
      );
      this.offset += width;
      return value;
    }
    return escape;
  }

  skipSpace() {
    while (/\s/.test(this.source[this.offset] ?? '')) this.offset += 1;
  }

  fail(message) {
    throw new SyntaxError(`${message} at offset ${this.offset}: ${this.source}`);
  }
}

function decodeCanonical(source) {
  return new CanonicalParser(source).parse();
}

function quoteAtom(value) {
  return `'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')}'`;
}

function encodeCanonical(term) {
  switch (term.type) {
    case 'atom':
      return quoteAtom(term.value);
    case 'string':
      return JSON.stringify(term.value);
    case 'integer':
    case 'float':
      return term.value;
    case 'rational':
      return `${term.numerator}r${term.denominator}`;
    case 'variable':
      return `V${term.id}`;
    case 'compound':
      return `${quoteAtom(term.functor)}(${term.args.map(encodeCanonical).join(',')})`;
    case 'list': {
      const items = term.items.map(encodeCanonical).join(',');
      return `[${items}${term.tail === null ? '' : `${items ? '|' : '|'}${encodeCanonical(term.tail)}`}]`;
    }
    default:
      throw new TypeError(`unknown term type: ${term.type}`);
  }
}

module.exports = { decodeCanonical, encodeCanonical };
