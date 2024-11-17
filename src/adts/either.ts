const eitherTag = Symbol('either')
export type Either<LeftValue, RightValue> = Right<RightValue> | Left<LeftValue>

export type Left<Value> = {
  readonly [eitherTag]: 'left'
  readonly value: Value
}

export type Right<Value> = {
  readonly [eitherTag]: 'right'
  readonly value: Value
}

export const makeLeft = <const Value>(value: Value): Left<Value> => ({
  [eitherTag]: 'left',
  value,
})

export const makeRight = <const Value>(value: Value): Right<Value> => ({
  [eitherTag]: 'right',
  value,
})

export const tryCatch = <RightValue>(
  operation: () => RightValue,
): Either<unknown, RightValue> => {
  try {
    return makeRight(operation())
  } catch (error) {
    return makeLeft(error)
  }
}

export const flatMap = <LeftValue, RightValue, NewLeftValue, NewRightValue>(
  either: Either<LeftValue, RightValue>,
  f: (value: RightValue) => Either<NewLeftValue, NewRightValue>,
): Either<LeftValue | NewLeftValue, NewRightValue> =>
  match(either, {
    left: makeLeft,
    right: f,
  })

export const map = <LeftValue, RightValue, NewRightValue>(
  either: Either<LeftValue, RightValue>,
  f: (value: RightValue) => NewRightValue,
): Either<LeftValue, NewRightValue> =>
  match(either, {
    left: makeLeft,
    right: value => makeRight(f(value)),
  })

export const mapLeft = <LeftValue, RightValue, NewLeftValue>(
  either: Either<LeftValue, RightValue>,
  f: (value: LeftValue) => NewLeftValue,
): Either<NewLeftValue, RightValue> =>
  match(either, {
    left: value => makeLeft(f(value)),
    right: makeRight,
  })

export const isLeft = (
  either: Either<unknown, unknown>,
): either is Left<unknown> => either[eitherTag] === 'left'

export const match = <LeftValue, RightValue, LeftResult, RightResult>(
  adt: Either<LeftValue, RightValue>,
  cases: {
    left: (value: LeftValue) => LeftResult
    right: (value: RightValue) => RightResult
  },
): LeftResult | RightResult => {
  switch (adt[eitherTag]) {
    case 'left':
      return cases[adt[eitherTag]](adt.value)
    case 'right':
      return cases[adt[eitherTag]](adt.value)
  }
}
