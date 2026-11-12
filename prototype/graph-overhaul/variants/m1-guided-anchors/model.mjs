// Fold referents, never rules. Loops attach complete advice to a concept, not a self-relation.
export function cleanedNetwork(g) {
  const bare = new Set(['patient', 'benefit', 'risk']);
  const text = id => id.replaceAll('-', ' ');
  const example = id => text(id.replace(/-example$/, ''));
  const nodes = new Map();
  const sourceNodes = new Map(g.network.nodes.map(n => [n.id, n]));
  const add = (id, rule) => {
    const before = sourceNodes.get(id);
    const node = nodes.get(id) ?? { id, label: text(id), roles: [], rules: [] };
    for (const role of before.roles) if (!node.roles.includes(role)) node.roles.push(role);
    if (!node.rules.includes(rule)) node.rules.push(rule);
    nodes.set(id, node);
    return id;
  };
  const exampleEdge = e => e.source.endsWith('-example') || e.target.endsWith('-example');
  const edges = g.network.edges.filter(e => !exampleEdge(e)).map(e => {
    const sourceBare = bare.has(e.source), targetBare = bare.has(e.target);
    const source = add(sourceBare ? e.target : e.source, e.rule);
    const target = add(targetBare ? e.source : e.target, e.rule);
    const folded = sourceBare || targetBare;
    const originalReading = `${text(e.source)} — ${e.verb} — ${text(e.target)}`;
    return { ...e, source, target,
      verb: folded ? (sourceBare ? `For the patient: clinicians ${e.verb} ${text(e.target)}` : `${e.verb} ${text(e.target)}`) : e.verb,
      detail: [e.detail, folded ? `Attached rule, not a self-relation. Original reading: ${originalReading}.` : ''].filter(Boolean).join(' '),
      folded,
    };
  });
  // User ruling (r2 pick): example lists sit beside the rule that states them, never as nodes or edges.
  const examples = new Map();
  for (const e of g.network.edges.filter(exampleEdge)) {
    const key = `${e.rule}|${e.source}|${e.verb}`;
    const row = examples.get(key) ?? { rule: e.rule, subject: example(e.source), verb: e.verb, modal: e.modal, items: [] };
    row.items.push(example(e.target));
    examples.set(key, row);
  }
  return { nodes: [...nodes.values()], edges, examples: [...examples.values()] };
}
