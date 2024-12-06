import { type KeywordModule } from '../../semantics.js'
import {
  applyKeyword,
  applyKeywordHandler,
} from './expressions/apply-expression.js'
import {
  checkKeyword,
  checkKeywordHandler,
} from './expressions/check-expression.js'
import {
  functionKeyword,
  functionKeywordHandler,
} from './expressions/function-expression.js'
import {
  lookupKeyword,
  lookupKeywordHandler,
} from './expressions/lookup-expression.js'
import {
  runtimeKeyword,
  runtimeKeywordHandler,
} from './expressions/runtime-expression.js'
import {
  todoKeyword,
  todoKeywordHandler,
} from './expressions/todo-expression.js'

export const handlers = {
  /**
   * Calls the given function with a given argument.
   */
  [applyKeyword]: applyKeywordHandler,

  /**
   * Checks whether a given value is assignable to a given type.
   */
  [checkKeyword]: checkKeywordHandler,

  /**
   * Creates a function.
   */
  [functionKeyword]: functionKeywordHandler,

  /**
   * Given a query, resolves the value of a property within the program.
   */
  [lookupKeyword]: lookupKeywordHandler,

  /**
   * Defers evaluation until runtime.
   */
  [runtimeKeyword]: runtimeKeywordHandler,

  /**
   * Ignores all properties and evaluates to an empty object.
   */
  [todoKeyword]: todoKeywordHandler,
} satisfies KeywordModule<`@${string}`>['handlers']

export type Keyword = keyof typeof handlers

// `isKeyword` is correct as long as `handlers` does not have excess properties.
const allKeywords = new Set(Object.keys(handlers))
export const isKeyword = (input: string): input is Keyword =>
  allKeywords.has(input)
