export type UnknownKeywordError = {
  readonly kind: 'unknownKeyword'
  readonly message: string
}

export type InvalidKeywordUsageError = {
  readonly kind: 'invalidKeywordUsage'
  readonly message: string
}

export type KeywordError = UnknownKeywordError | InvalidKeywordUsageError

export type InvalidMoleculeError = {
  readonly kind: 'invalidMolecule'
  readonly message: string
}

export type CompilationError = InvalidMoleculeError | KeywordError
