import { makeLeft, makeRight, match, type Either, type Left } from './either.js'

export const flatMap = <LeftValue, RightValue, NewLeftValue, NewRightValue>(
  either: Either<LeftValue, RightValue>,
  f: (value: RightValue) => Either<NewLeftValue, NewRightValue>,
): Either<LeftValue | NewLeftValue, NewRightValue> =>
  match(either, {
    left: makeLeft,
    right: f,
  })

export const isLeft = (
  either: Either<unknown, unknown>,
): either is Left<unknown> =>
  match(either, { left: _ => true, right: _ => false })

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

export const tryCatch = <RightValue>(
  operation: () => RightValue,
): Either<unknown, RightValue> => {
  try {
    return makeRight(operation())
  } catch (error) {
    return makeLeft(error)
  }
}
