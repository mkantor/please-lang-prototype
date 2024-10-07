const eitherTag = Symbol('either')
export type Either<Left, Right> =
  | {
      readonly [eitherTag]: 'left'
      readonly value: Left
    }
  | {
      readonly [eitherTag]: 'right'
      readonly value: Right
    }

export const makeLeft = <const Value>(value: Value) =>
  ({
    [eitherTag]: 'left',
    value,
  } satisfies Either<Value, never>)

export const makeRight = <const Value>(value: Value) =>
  ({
    [eitherTag]: 'right',
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

export const map = <Left, Right, NewRight>(
  either: Either<Left, Right>,
  f: (value: Right) => NewRight,
): Either<Left, NewRight> =>
  match<Left, Right, Either<Left, NewRight>>(either, {
    left: makeLeft<Left>,
    right: value => makeRight(f(value)),
  })

export const isLeft = (
  either: Either<unknown, unknown>,
): either is Extract<Either<unknown, unknown>, { [eitherTag]: 'left' }> =>
  either[eitherTag] === 'left'

export const match = <Left, Right, Result>(
  adt: Either<Left, Right>,
  cases: {
    left: (value: Left) => Result
    right: (value: Right) => Result
  },
): Result => {
  switch (adt[eitherTag]) {
    case 'left':
      return cases[adt[eitherTag]](adt.value)
    case 'right':
      return cases[adt[eitherTag]](adt.value)
  }
}
