const tagKey = Symbol('option')
export type Option<Value> =
  | {
      readonly [tagKey]: 'none'
    }
  | {
      readonly [tagKey]: 'some'
      readonly value: Value
    }

export const none = { [tagKey]: 'none' } satisfies Option<never>

export const makeSome = <Value>(value: Value) =>
  ({
    [tagKey]: 'some',
    value,
  } satisfies Option<Value>)

export const flatMap = <Value, NewValue>(
  option: Option<Value>,
  f: (value: Value) => Option<NewValue>,
): Option<NewValue> => match(option, { none: () => none, some: f })

export const match = <Value, Result>(
  adt: Option<Value>,
  cases: {
    none: () => Result
    some: (value: Value) => Result
  },
): Result => {
  switch (adt[tagKey]) {
    case 'none':
      return cases[adt[tagKey]]()
    case 'some':
      return cases[adt[tagKey]](adt.value)
  }
}
