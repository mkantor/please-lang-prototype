import { either } from '../../adts.js'
import { keywordHandlers as compilerKeywordHandlers } from '../compiling.js'
import {
  isFunctionNode,
  makeFunctionNode,
  makeObjectNode,
  types,
  type KeywordElaborationResult,
  type KeywordModule,
} from '../semantics.js'

const runtimeContext = makeObjectNode({
  environment: makeObjectNode({
    lookup: makeFunctionNode(
      {
        parameter: types.string,
        return: types.option(types.string),
      },
      () =>
        either.makeLeft({
          kind: 'unserializableValue',
          message: 'this function cannot be serialized',
        }),
      key => {
        if (typeof key !== 'string') {
          return either.makeLeft({
            kind: 'panic',
            message: 'key was not an atom',
          })
        } else {
          const environmentVariable = process.env[key]
          if (environmentVariable === undefined) {
            return either.makeRight(
              makeObjectNode({
                tag: 'none',
                value: makeObjectNode({}),
              }),
            )
          } else {
            return either.makeRight(
              makeObjectNode({
                tag: 'some',
                value: environmentVariable,
              }),
            )
          }
        }
      },
    ),
  }),
})

export const handlers = {
  ...compilerKeywordHandlers,
  /**
   * Evaluates the given function, passing runtime context captured in `world`.
   */
  '@runtime': (expression): KeywordElaborationResult => {
    const runtimeFunction = expression.function ?? expression['1']
    if (runtimeFunction === undefined || !isFunctionNode(runtimeFunction)) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message:
          'a function must be provided via the property `function` or `1`',
      })
    } else {
      return runtimeFunction(runtimeContext)
    }
  },
} satisfies KeywordModule<`@${string}`>['handlers']

export type Keyword = keyof typeof handlers

// `isKeyword` is correct as long as `handlers` does not have excess properties.
const allKeywords = new Set(Object.keys(handlers))
export const isKeyword = (input: string): input is Keyword =>
  allKeywords.has(input)
