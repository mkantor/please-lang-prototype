const optionTag = Symbol('option')
export type Option<Value> =
  | {
      readonly [optionTag]: 'none'
    }
  | {
      readonly [optionTag]: 'some'
      readonly value: Value
    }

export const none = { [optionTag]: 'none' } satisfies Option<never>

export const makeSome = <const Value>(value: Value) =>
  ({
    [optionTag]: 'some',
    value,
  } satisfies Option<Value>)

export const isNone = (option: Option<unknown>): option is typeof none =>
  option[optionTag] === 'none'

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

export const match = <Value, Result>(
  adt: Option<Value>,
  cases: {
    none: () => Result
    some: (value: Value) => Result
  },
): Result => {
  switch (adt[optionTag]) {
    case 'none':
      return cases[adt[optionTag]]()
    case 'some':
      return cases[adt[optionTag]](adt.value)
  }
}
