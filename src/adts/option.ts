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

export const isNone = (option: Option<unknown>): option is typeof none =>
  option[optionTag] === 'none'

export const fromPredicate = <InputValue, Value extends InputValue>(
  value: InputValue,
  predicate: (value: InputValue) => value is Value,
): Option<Value> => (predicate(value) ? makeSome(value) : none)

export const flatMap = <Value, NewValue>(
  option: Option<Value>,
  f: (value: Value) => Option<NewValue>,
): Option<NewValue> => match(option, { none: () => none, some: f })

export const map = <Value, NewValue>(
  option: Option<Value>,
  f: (value: Value) => NewValue,
): Option<NewValue> =>
  match(option, {
    none: (): Option<NewValue> => none,
    some: value => makeSome(f(value)),
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
