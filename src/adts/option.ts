const optionTag = Symbol('option')
export type Option<Value> = None | Some<Value>

export type None = {
  readonly [optionTag]: 'none'
}

export type Some<Value> = {
  readonly [optionTag]: 'some'
  readonly value: Value
}

export const none: None = { [optionTag]: 'none' }

export const makeSome = <const Value>(value: Value): Some<Value> => ({
  [optionTag]: 'some',
  value,
})

export const match = <Value, NoneResult, SomeResult>(
  adt: Option<Value>,
  cases: {
    none: () => NoneResult
    some: (value: Value) => SomeResult
  },
): NoneResult | SomeResult => {
  switch (adt[optionTag]) {
    case 'none':
      return cases[adt[optionTag]]()
    case 'some':
      return cases[adt[optionTag]](adt.value)
  }
}
