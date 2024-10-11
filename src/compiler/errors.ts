export type UnknownKeywordError = {
  readonly kind: 'unknownKeyword'
  readonly message: string
}

export type InvalidMoleculeError = {
  readonly kind: 'invalidMolecule'
  readonly message: string
}

export type CompilationError = UnknownKeywordError | InvalidMoleculeError
