export type UnknownKeywordError = {
  readonly kind: 'unknownKeyword'
  readonly message: string
}

export type ValidationError = {
  readonly kind: 'moleculeValidation'
  readonly message: string
}

export type CompilationError = UnknownKeywordError | ValidationError
