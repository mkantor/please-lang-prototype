import { either, type Either } from '../adts.js'
import type { CompilationError } from '../errors.js'
import type { JSONValueForbiddingSymbolicKeys } from '../parsing.js'
import { canonicalize } from '../parsing.js'
import { elaborate } from '../semantics.js'
import { serialize, type Code } from './code-generation/serialization.js'
import * as keywordModule from './semantics/keywords.js'

export const compile = (
  input: JSONValueForbiddingSymbolicKeys,
): Either<CompilationError, Code> => {
  const syntaxTree = canonicalize(input)
  const semanticGraphResult = elaborate(syntaxTree, keywordModule)
  return either.map(semanticGraphResult, serialize)
}
