import { all, boot, categoryA, compoundArgs } from './lib.mjs';

const { engine, diagnostics } = await boot();
const goal =
  `set_prolog_flag(stack_limit,67108864),` +
  `call_with_inference_limit(call_with_depth_limit((${categoryA}),1000,D),100000,I)`;
const answers = all(engine, goal);
const shapes = answers.map(({ A }) => {
  const args = compoundArgs(A);
  const ref = compoundArgs(args?.[3]);
  return {
    functor: A?.functor,
    arity: args?.length,
    id: args?.[1],
    refFunctor: args?.[3]?.functor,
    refArity: ref?.length,
    tailIsEmptyList: Array.isArray(args?.[4]) && args[4].length === 0,
  };
});
console.log(`solutions=${answers.length}`);
console.log(`ids=${shapes.map(({ id }) => id).join(',')}`);
console.log(`functors=${[...new Set(shapes.map(({ functor }) => functor))].join(',')}`);
console.log(`arities=${[...new Set(shapes.map(({ arity }) => arity))].join(',')}`);
console.log(`ref_shapes=${[...new Set(shapes.map(({ refFunctor, refArity }) => `${refFunctor}/${refArity}`))].join(',')}`);
console.log(`empty_tails=${shapes.filter(({ tailIsEmptyList }) => tailIsEmptyList).length}`);
console.log(`depth_outcomes=${[...new Set(answers.map(({ D }) => D))].join(',')}`);
console.log(`inference_outcomes=${[...new Set(answers.map(({ I }) => I))].join(',')}`);
console.log(`diagnostics=${diagnostics.length}`);
