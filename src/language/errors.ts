export type BadSyntax = {
  readonly kind: 'badSyntax'
  readonly message: string
}

export type Bug = {
  readonly kind: 'bug'
  readonly message: string
}

export type DependencyUnavailable = {
  readonly kind: 'dependencyUnavailable'
  readonly message: string
}

export type InvalidExpressionError = {
  readonly kind: 'invalidExpression'
  readonly message: string
}

export type InvalidSyntaxTreeError = {
  readonly kind: 'invalidSyntaxTree'
  readonly message: string
}

export type Panic = {
  readonly kind: 'panic'
  readonly message: string
}

export type UnserializableValueError = {
  readonly kind: 'unserializableValue'
  readonly message: string
}

export type TypeMismatchError = {
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
  | InvalidSyntaxTreeError
  | Panic
  | TypeMismatchError
  | UnknownKeywordError

export type ParseError = BadSyntax

export type CompilationError = ElaborationError | UnserializableValueError

export type RuntimeError = ElaborationError | UnserializableValueError
