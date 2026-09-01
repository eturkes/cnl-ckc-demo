import type { PlBindings, PlTerm, QueryReply } from './decoder.mjs';

const unreachable = (value: never): never => {
  throw new Error(`unreachable discriminant: ${JSON.stringify(value)}`);
};

export function requireBinding(bindings: PlBindings, name: string): PlTerm {
  const term = bindings[name];
  if (term === undefined) throw new Error(`missing binding: ${name}`);
  return term;
}

export function termKind(term: PlTerm): string {
  switch (term.kind) {
    case 'atom':
    case 'string':
    case 'integer':
    case 'float':
    case 'rational':
    case 'list':
    case 'improper-list':
    case 'compound':
    case 'variable':
    case 'dict':
      return term.kind;
    default:
      return unreachable(term);
  }
}

export function replyKind(reply: QueryReply): string {
  switch (reply.kind) {
    case 'solutions':
      return `${reply.requestId}:${reply.solutions.length}`;
    case 'failure':
      return `${reply.requestId}:failure`;
    case 'error':
      return `${reply.requestId}:${reply.error.kind}`;
    default:
      return unreachable(reply);
  }
}
