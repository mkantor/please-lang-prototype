export type Bug = {
  readonly kind: 'bug'
  readonly message: string
}

export type InvalidExpressionError = {
  readonly kind: 'invalidExpression'
  readonly message: string
}

export type InvalidSyntaxError = {
  readonly kind: 'invalidSyntax'
  readonly message: string
}

export type Panic = {
  readonly kind: 'panic'
  readonly message: string
}

export type TypeMismatch = {
  readonly kind: 'typeMismatch'
  readonly message: string
}

export type UnknownKeywordError = {
  readonly kind: 'unknownKeyword'
  readonly message: string
}

export type ElaborationError =
  | Bug
  | InvalidExpressionError
  | InvalidSyntaxError
  | Panic
  | TypeMismatch
  | UnknownKeywordError

export type CompilationError = ElaborationError
