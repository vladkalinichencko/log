export type TransitionTable<S extends string, E extends string> = {
  [state in S]?: { [event in E]?: S };
};

export interface Fsm<S extends string, E extends string> {
  initial: S;
  next(state: S, event: E): S;
}

export function makeFsm<S extends string, E extends string>(
  states: readonly S[],
  transitions: TransitionTable<S, E>
): Fsm<S, E> {
  return {
    initial: states[0],
    next(state: S, event: E): S {
      const nextState = transitions[state]?.[event];
      return nextState !== undefined ? nextState : state;
    },
  };
}
