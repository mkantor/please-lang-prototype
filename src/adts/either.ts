const tagKey = Symbol('either')
export type Either<Left, Right> =
  | {
      readonly [tagKey]: 'left'
      readonly value: Left
    }
  | {
      readonly [tagKey]: 'right'
      readonly value: Right
    }

export const makeLeft = <const Value>(value: Value) =>
  ({
    [tagKey]: 'left',
    value,
  } satisfies Either<Value, never>)

export const makeRight = <const Value>(value: Value) =>
  ({
    [tagKey]: 'right',
    value,
  } satisfies Either<never, Value>)

export const flatMap = <Left, Right, NewLeft, NewRight>(
  either: Either<Left, Right>,
  f: (value: Right) => Either<NewLeft, NewRight>,
): Either<Left | NewLeft, NewRight> =>
  match<Left, Right, Either<Left | NewLeft, NewRight>>(either, {
    left: makeLeft,
    right: f,
  })

export const match = <Left, Right, Result>(
  adt: Either<Left, Right>,
  cases: {
    left: (value: Left) => Result
    right: (value: Right) => Result
  },
): Result => {
  switch (adt[tagKey]) {
    case 'left':
      return cases[adt[tagKey]](adt.value)
    case 'right':
      return cases[adt[tagKey]](adt.value)
  }
}
