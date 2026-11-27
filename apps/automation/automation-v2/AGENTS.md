# automation-v2

Overlord tasks for Temple, in TypeScript. `package.json` has the scripts; `yarn tsc --noEmit` and `yarn test --run` must pass.

## Conventions

**Companion objects.** A type and the functions that derive or read it share one name: a type and a same-named `const` holding those functions.

```ts
export type DepositorState = 'ToExclude' | 'ReinstateAvailable' | 'MissedExclusion' | 'Clear';

export const DepositorState = {
  from(phase: AuctionPhase, flagged: boolean, position: DepositorPosition): DepositorState { … },
  dependsOnFlag(phase: AuctionPhase, position: DepositorPosition): boolean { … },
};
```

Callers write `DepositorState.from(…)`, so typing the type's name finds everything about it. Name members by what they do: `from` derives a value from inputs, `initial` makes the starting value, `parse` reads outside data, a noun (`snapshot`, `id`) reads a part. Constants about the type live there too (`CuratedList.FORMAT`). Verbs that act across several types (`planFlags`, `transition`) stay free functions.

**Exhaustive switches.** A `switch` over a union lists every case and ends with `default: return assertNever(x)` (`@/tlc/assert-never`), so a new member fails the typecheck at every switch.

## Modules

`src/tasks/compliance/`: read its `README.md` before changing it. It defines the folder layout (`run.ts` seam, pure `plan.ts`/`state.ts`, `task.ts` wiring, `index.ts` barrels) and its vocabulary.
