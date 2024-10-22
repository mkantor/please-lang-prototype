export type InvalidKeywordArgumentsError = {
  readonly kind: 'invalidKeywordArguments'
  readonly message: string
}

export type InvalidSyntaxError = {
  readonly kind: 'invalidSyntax'
  readonly message: string
}

export type UnknownKeywordError = {
  readonly kind: 'unknownKeyword'
  readonly message: string
}

export type TypeMismatch = {
  readonly kind: 'typeMismatch'
  readonly message: string
}

export type KeywordError =
  | InvalidKeywordArgumentsError
  | InvalidSyntaxError
  | TypeMismatch
  | UnknownKeywordError

export type CompilationError = KeywordError
