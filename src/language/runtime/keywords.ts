import { either, option, type Option } from '../../adts.js'
import { keywordHandlers as compilerKeywordHandlers } from '../compiling.js'
import type { Atom } from '../parsing.js'
import {
  isFunctionNode,
  makeFunctionNode,
  makeObjectNode,
  types,
  type KeywordElaborationResult,
  type KeywordModule,
  type ObjectNode,
  type SemanticGraph,
} from '../semantics.js'
import { lookupPropertyOfObjectNode } from '../semantics/object-node.js'

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
      option.none,
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
    const runtimeFunction = lookupWithinArgument(['function', '1'], expression)
    if (
      option.isNone(runtimeFunction) ||
      !isFunctionNode(runtimeFunction.value)
    ) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message:
          'a function must be provided via the property `function` or `1`',
      })
    } else {
      const result = runtimeFunction.value(runtimeContext)
      if (either.isLeft(result)) {
        // The runtime function panicked or had an unavailable dependency (which results in a panic
        // anyway in this context).
        return either.makeLeft({
          kind: 'panic',
          message: result.value.message,
        })
      } else {
        return result
      }
    }
  },
} satisfies KeywordModule<`@${string}`>['handlers']

export type Keyword = keyof typeof handlers

// `isKeyword` is correct as long as `handlers` does not have excess properties.
const allKeywords = new Set(Object.keys(handlers))
export const isKeyword = (input: string): input is Keyword =>
  allKeywords.has(input)

const lookupWithinArgument = (
  keyAliases: [Atom, ...(readonly Atom[])],
  argument: ObjectNode,
): Option<SemanticGraph> => {
  for (const key of keyAliases) {
    const result = lookupPropertyOfObjectNode(key, argument)
    if (!option.isNone(result)) {
      return result
    }
  }
  return option.none
}
