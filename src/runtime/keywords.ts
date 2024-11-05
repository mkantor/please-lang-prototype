import { either } from '../adts.js'
import { keywordHandlers as compilerKeywordHandlers } from '../compiling.js'
import {
  isAtomNode,
  isFunctionNode,
  makeAtomNode,
  makeFunctionNode,
  makeObjectNode,
  type KeywordElaborationResult,
  type KeywordModule,
} from '../semantics.js'

const world = makeObjectNode({
  environment: makeObjectNode({
    lookup: makeFunctionNode(key => {
      if (!isAtomNode(key)) {
        return either.makeLeft({
          kind: 'panic',
          message: 'key was not an atom',
        })
      } else {
        const environmentVariable = process.env[key.atom]
        if (environmentVariable === undefined) {
          return either.makeRight(
            makeObjectNode({
              tag: makeAtomNode('none'),
              value: makeObjectNode({}),
            }),
          )
        } else {
          return either.makeRight(
            makeObjectNode({
              tag: makeAtomNode('some'),
              value: makeAtomNode(environmentVariable),
            }),
          )
        }
      }
    }),
  }),
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
