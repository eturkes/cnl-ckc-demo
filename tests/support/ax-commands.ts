// Server-side browser commands: what Chromium's own accessibility tree says about the combobox.
//
// jsdom has no accessibility tree, so an accessible name or an activedescendant relation could
// only ever be inferred from attributes there. These read the tree Chromium builds, over CDP,
// from the frame the test renders in.

import type { BrowserCommand } from 'vitest/node';

interface AxValue {
  value?: unknown;
  relatedNodes?: { backendDOMNodeId?: number }[];
}
interface AxNode {
  role?: AxValue;
  name?: AxValue;
  backendDOMNodeId?: number;
  properties?: { name: string; value: AxValue }[];
}

export interface AxCombobox {
  /** Accessible name Chromium computed for the `combobox` node, or null when none exists. */
  name: string | null;
  expanded: boolean | null;
  /** Accessible name of the node the `activedescendant` relation points at. */
  activeDescendant: string | null;
}

export const axCombobox: BrowserCommand<[]> = async (context) => {
  if (!('page' in context)) throw new Error('axCombobox needs the playwright provider');
  const cdp = await context.page.context().newCDPSession(context.page);
  try {
    const { frameTree } = (await cdp.send('Page.getFrameTree')) as {
      frameTree: { frame: { id: string }; childFrames?: unknown[] };
    };
    type Tree = { frame: { id: string }; childFrames?: Tree[] };
    const frames: string[] = [];
    const walk = (tree: Tree): void => {
      frames.push(tree.frame.id);
      for (const child of tree.childFrames ?? []) walk(child);
    };
    walk(frameTree as Tree);
    for (const frameId of frames) {
      const { nodes } = (await cdp.send('Accessibility.getFullAXTree', { frameId })) as {
        nodes: AxNode[];
      };
      const box = nodes.find((node) => node.role?.value === 'combobox');
      if (box === undefined) continue;
      const property = (name: string): AxValue | undefined =>
        box.properties?.find((entry) => entry.name === name)?.value;
      const related = property('activedescendant')?.relatedNodes?.[0]?.backendDOMNodeId;
      const target = nodes.find((node) => node.backendDOMNodeId === related);
      const expanded = property('expanded')?.value;
      const result: AxCombobox = {
        name: typeof box.name?.value === 'string' ? box.name.value : null,
        expanded: typeof expanded === 'boolean' ? expanded : null,
        activeDescendant:
          related === undefined || typeof target?.name?.value !== 'string'
            ? null
            : target.name.value,
      };
      return result;
    }
    return { name: null, expanded: null, activeDescendant: null } satisfies AxCombobox;
  } finally {
    await cdp.detach();
  }
};
