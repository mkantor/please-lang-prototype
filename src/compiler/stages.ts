declare const _compilationStageKey: unique symbol

export type Canonicalized = {
  readonly [_compilationStageKey]: 'canonicalized'
}

export type KeywordsApplied = {
  readonly [_compilationStageKey]: 'keywordsApplied'
}
