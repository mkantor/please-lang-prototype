export type UnknownKeywordError = {
  readonly kind: 'unknownKeyword'
  readonly message: string
}

export type InvalidKeywordArgumentsError = {
  readonly kind: 'invalidKeywordArguments'
  readonly message: string
}

export type TypeMismatch = {
  readonly kind: 'typeMismatch'
  readonly message: string
}

export type KeywordError =
  | UnknownKeywordError
  | InvalidKeywordArgumentsError
  | TypeMismatch

export type InvalidMoleculeError = {
  readonly kind: 'invalidMolecule'
  readonly message: string
}

export type CompilationError = InvalidMoleculeError | KeywordError
