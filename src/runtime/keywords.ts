import { either } from '../adts.js'
import { keywordHandlers as compilerKeywordHandlers } from '../compiling.js'
import {
  isFunctionNode,
  type KeywordElaborationResult,
  type KeywordModule,
} from '../semantics.js'
import { literalMoleculeToObjectNode } from '../semantics/semantic-graph.js'

const world = literalMoleculeToObjectNode({
  environment: process.env as Record<string, string>, // `process.env` doesn't actually contain `undefined`s
})

export const handlers = {
  ...compilerKeywordHandlers,
  /**
   * Evaluates the given function, passing runtime context captured in `world`.
   */
  '@runtime': (expression): KeywordElaborationResult => {
    const runtimeFunction =
      expression.children.function ?? expression.children['1']
    if (runtimeFunction === undefined || !isFunctionNode(runtimeFunction)) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message:
          'a function must be provided via a property named `function` or the first positional argument',
      })
    } else {
      return runtimeFunction.function(world)
    }
  },
} satisfies KeywordModule<`@${string}`>['handlers']

export type Keyword = keyof typeof handlers

// `isKeyword` is correct as long as `handlers` does not have excess properties.
const allKeywords = new Set(Object.keys(handlers))
export const isKeyword = (input: string): input is Keyword =>
  allKeywords.has(input)
