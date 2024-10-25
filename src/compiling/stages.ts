declare const _compilationStageKey: unique symbol

export type Canonicalized = {
  readonly [_compilationStageKey]: 'canonicalized'
}

export type Elaborated = {
  readonly [_compilationStageKey]: 'elaborated'
}
