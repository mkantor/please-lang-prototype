import { type KeywordHandlers } from '../../semantics.js'
import { applyKeywordHandler } from './keyword-handlers/apply-handler.js'
import { checkKeywordHandler } from './keyword-handlers/check-handler.js'
import { functionKeywordHandler } from './keyword-handlers/function-handler.js'
import { lookupKeywordHandler } from './keyword-handlers/lookup-handler.js'
import { runtimeKeywordHandler } from './keyword-handlers/runtime-handler.js'
import { todoKeywordHandler } from './keyword-handlers/todo-handler.js'

export const keywordHandlers: KeywordHandlers = {
  /**
   * Calls the given function with a given argument.
   */
  '@apply': applyKeywordHandler,

  /**
   * Checks whether a given value is assignable to a given type.
   */
  '@check': checkKeywordHandler,

  /**
   * Creates a function.
   */
  '@function': functionKeywordHandler,

  /**
   * Given a query, resolves the value of a property within the program.
   */
  '@lookup': lookupKeywordHandler,

  /**
   * Defers evaluation until runtime.
   */
  '@runtime': runtimeKeywordHandler,

  /**
   * Ignores all properties and evaluates to an empty object.
   */
  '@todo': todoKeywordHandler,
}
