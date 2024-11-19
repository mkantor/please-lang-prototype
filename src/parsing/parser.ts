import type { Either } from '../adts.js'
import type { Right } from '../adts/either.js'

export type Success<Output> = {
  readonly remainingInput: string
  readonly output: Output
}

export type InvalidInputError = {
  readonly input: string
  readonly message: string
}

export type Parser<Output> = (
  input: string,
) => Either<InvalidInputError, Success<Output>>

export type AlwaysSucceedingParser<Output> = (
  input: string,
) => Right<Success<Output>>
