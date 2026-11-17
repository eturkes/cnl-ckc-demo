// Browser-executed calls + browser-read state; no renderer-authored records enter this layer.
export interface State {
  transform: number[];
  font: string;
  textRendering: CanvasTextRendering;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  width: number;
  fill: string;
  stroke: string;
  alpha: number;
  join: CanvasLineJoin;
}
export interface Call {
  name: string;
  args: unknown[];
  state: State;
  left?: number;
  right?: number;
  advance?: number;
}
const clock = new Map<number, FrameRequestCallback>();
let requestId = 0;
window.requestAnimationFrame = (callback) => {
  clock.set(++requestId, callback);
  return requestId;
};
window.cancelAnimationFrame = (id) => {
  clock.delete(id);
};
export const flush = () => {
  for (let round = 0; clock.size; round++) {
    if (round > 20) throw new Error('animation clock never drains');
    const batch = [...clock.values()];
    clock.clear();
    for (const callback of batch) callback(performance.now());
  }
};
let calls: Call[] = [];
let lastTransform: Call | undefined;
let host: HTMLElement | undefined;
const measurements = new Map<string, { left: number; right: number; advance: number }>();
export const observe = (container: HTMLElement) => {
  host = container;
  calls = [];
  lastTransform = undefined;
};
export const frame = () => calls;
const prototype = CanvasRenderingContext2D.prototype;
// Intern immutable state snapshots. Native setters/restore/reset/resize invalidate browser reads;
// each call still carries its exact state, without allocating one DOMMatrix per path command.
const cache = new WeakMap<CanvasRenderingContext2D, { state?: State; dirty: Set<string> }>();
const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
const invalidate = (ctx: CanvasRenderingContext2D, property = 'all') => {
  const c = cache.get(ctx) ?? { dirty: new Set<string>() };
  c.dirty.add(property);
  cache.set(ctx, c);
};
for (const property of [
  'font',
  'textRendering',
  'textAlign',
  'textBaseline',
  'lineWidth',
  'fillStyle',
  'strokeStyle',
  'globalAlpha',
  'lineJoin',
]) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
  // eslint-disable-next-line @typescript-eslint/unbound-method -- native setter receives its original context through Reflect.apply
  const setter = descriptor?.set as
    ((this: CanvasRenderingContext2D, value: unknown) => void) | undefined;
  if (!descriptor || !setter) throw new Error(`missing native setter ${property}`);
  Object.defineProperty(prototype, property, {
    ...descriptor,
    set: function (this: CanvasRenderingContext2D, value: unknown) {
      Reflect.apply(setter, this, [value]);
      invalidate(this, property);
    },
  });
}
for (const property of ['width', 'height']) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, property);
  // eslint-disable-next-line @typescript-eslint/unbound-method -- native setter receives its original context through Reflect.apply
  const setter = descriptor?.set as ((this: HTMLCanvasElement, value: unknown) => void) | undefined;
  if (!descriptor || !setter) throw new Error(`missing canvas setter ${property}`);
  Object.defineProperty(HTMLCanvasElement.prototype, property, {
    ...descriptor,
    set: function (this: HTMLCanvasElement, value: unknown) {
      Reflect.apply(setter, this, [value]);
      const ctx = contexts.get(this);
      if (ctx) invalidate(ctx);
    },
  });
}
const snapshot = (ctx: CanvasRenderingContext2D): State => {
  contexts.set(ctx.canvas, ctx);
  const c = cache.get(ctx) ?? { dirty: new Set(['all']) };
  if (!c.state || c.dirty.size) {
    const all = !c.state || c.dirty.has('all');
    const old = c.state;
    const changed = (name: string) => all || c.dirty.has(name);
    const m = changed('transform') ? ctx.getTransform() : undefined;
    c.state = {
      transform: m ? [m.a, m.b, m.c, m.d, m.e, m.f] : (old?.transform ?? []),
      font: changed('font') ? ctx.font : (old?.font ?? ''),
      textRendering: changed('textRendering') ? ctx.textRendering : (old?.textRendering ?? 'auto'),
      align: changed('textAlign') ? ctx.textAlign : (old?.align ?? 'start'),
      baseline: changed('textBaseline') ? ctx.textBaseline : (old?.baseline ?? 'alphabetic'),
      width: changed('lineWidth') ? ctx.lineWidth : (old?.width ?? 0),
      fill: changed('fillStyle')
        ? typeof ctx.fillStyle === 'string'
          ? ctx.fillStyle
          : 'non-solid'
        : (old?.fill ?? ''),
      stroke: changed('strokeStyle')
        ? typeof ctx.strokeStyle === 'string'
          ? ctx.strokeStyle
          : 'non-solid'
        : (old?.stroke ?? ''),
      alpha: changed('globalAlpha') ? ctx.globalAlpha : (old?.alpha ?? 0),
      join: changed('lineJoin') ? ctx.lineJoin : (old?.join ?? 'miter'),
    };
    c.dirty.clear();
    cache.set(ctx, c);
  }
  return c.state;
};
for (const name of [
  'fillText',
  'strokeText',
  'arc',
  'moveTo',
  'lineTo',
  'quadraticCurveTo',
  'stroke',
  'fill',
  'fillRect',
  'setTransform',
  'beginPath',
  'closePath',
  'restore',
  'reset',
  'translate',
  'rotate',
  'scale',
  'transform',
  'resetTransform',
] as const) {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- native context preserved through Reflect.apply
  const original = prototype[name] as unknown as (...args: unknown[]) => unknown;
  Object.defineProperty(prototype, name, {
    configurable: true,
    writable: true,
    value: function (this: CanvasRenderingContext2D, ...args: unknown[]) {
      const result: unknown = Reflect.apply(original, this, args);
      if (['restore', 'reset'].includes(name)) invalidate(this);
      if (
        ['setTransform', 'translate', 'rotate', 'scale', 'transform', 'resetTransform'].includes(
          name,
        )
      )
        invalidate(this, 'transform');
      if (!host?.contains(this.canvas)) return result;
      const state = snapshot(this);
      const call: Call = { name, args, state };
      if (name === 'fillText' || name === 'strokeText') {
        const text = String(args[0]);
        const key = `${state.font}\0${state.textRendering}\0${state.align}\0${state.baseline}\0${text}`;
        let measured = measurements.get(key);
        if (!measured) {
          const m = this.measureText(text);
          measured = {
            left: m.actualBoundingBoxLeft,
            right: m.actualBoundingBoxRight,
            advance: m.width,
          };
          measurements.set(key, measured);
        }
        Object.assign(call, measured);
      }
      if (name === 'setTransform') lastTransform = call;
      if (
        name === 'fillRect' &&
        Number(args[0]) === 0 &&
        Number(args[1]) === 0 &&
        Number(args[2]) === host.clientWidth &&
        Number(args[3]) === host.clientHeight
      )
        calls = lastTransform ? [lastTransform] : [];
      calls.push(call);
      return result;
    },
  });
}
