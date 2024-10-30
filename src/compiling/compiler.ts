import { either, type Either } from '../adts.js'
import type { JSONArray, JSONRecord, JSONValue } from '../utility-types.js'
import { serialize } from './code-generation/serialization.js'
import type { CompilationError } from './errors.js'
import type { SyntaxTree } from './parsing/syntax-tree.js'
import { canonicalize } from './parsing/syntax-tree.js'
import { elaborate } from './semantics/expression-elaboration.js'

export const compile = (
  input: JSONValueForbiddingSymbolicKeys,
): Either<CompilationError, SyntaxTree> => {
  const syntaxTree = canonicalize(input)
  const semanticGraphResult = elaborate(syntaxTree)
  return either.map(semanticGraphResult, serialize)
}

/**
 * Compiler inputs should not have symbolic keys. This type doesn't robustly guarantee that
 * (because symbolic keys can always be widened away), but will catch simple mistakes like directly
 * feeding an `Option<…>` into the compiler.
 */
export type JSONValueForbiddingSymbolicKeys =
  | Exclude<JSONValue, JSONArray | JSONRecord>
  | JSONArrayForbiddingSymbolicKeys
  | JSONRecordForbiddingSymbolicKeys

type JSONArrayForbiddingSymbolicKeys =
  readonly JSONValueForbiddingSymbolicKeys[]
type JSONRecordForbiddingSymbolicKeys = {
  readonly [key: string]: JSONValueForbiddingSymbolicKeys
} & Partial<{
  readonly [key: symbol]: undefined
}>
