// Fold referents, never rules. Loops attach complete advice to a concept, not a self-relation.
export function cleanedNetwork(g) {
  const bare = new Set(['patient', 'benefit', 'risk']);
  const generic = id => bare.has(id) || id.endsWith('-example');
  const text = id => id.replaceAll('-', ' ');
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
  const parent = e => {
    const document = e.rule.slice(0, e.rule.lastIndexOf(':'));
    const counts = new Map();
    for (const x of g.network.edges.filter(x => x.rule.startsWith(`${document}:`))) {
      if (!generic(x.source)) counts.set(x.source, (counts.get(x.source) ?? 0) + 1);
    }
    const found = [...counts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    if (!found) throw new Error(`No clinical parent for ${e.id}`);
    return found;
  };
  const edges = g.network.edges.map(e => {
    const sourceBare = bare.has(e.source), targetBare = bare.has(e.target);
    const example = e.source.endsWith('-example') || e.target.endsWith('-example');
    const context = example ? parent(e) : undefined;
    const source = add(context ?? (sourceBare ? e.target : e.source), e.rule);
    const target = add(context ?? (targetBare ? e.source : e.target), e.rule);
    const folded = example || sourceBare || targetBare;
    const originalReading = `${text(e.source)} — ${e.verb} — ${text(e.target)}`;
    return { ...e, source, target,
      verb: example ? originalReading : folded ? (sourceBare ? `For the patient: clinicians ${e.verb} ${text(e.target)}` : `${e.verb} ${text(e.target)}`) : e.verb,
      detail: [e.detail, folded ? `Attached rule, not a self-relation. Original reading: ${originalReading}.` : '', example ? 'Example terms retain their complete KB names here, rather than becoming nodes.' : ''].filter(Boolean).join(' '),
      folded,
    };
  });
  return { nodes: [...nodes.values()], edges };
}
