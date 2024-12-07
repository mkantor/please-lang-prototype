import { parseArgs } from 'util'
import { either, option, type Option } from '../../adts.js'
import { writeJSON } from '../cli/output.js'
import { keywordHandlers as compilerKeywordHandlers } from '../compiling.js'
import type { Atom } from '../parsing.js'
import {
  isFunctionNode,
  makeFunctionNode,
  makeObjectNode,
  serialize,
  types,
  type KeywordElaborationResult,
  type KeywordModule,
  type SemanticGraph,
} from '../semantics.js'
import type { Expression } from '../semantics/expression-elaboration.js'
import { lookupPropertyOfObjectNode } from '../semantics/object-node.js'

const unserializableFunction = () =>
  either.makeLeft({
    kind: 'unserializableValue',
    message: 'this function cannot be serialized',
  })

const runtimeContext = makeObjectNode({
  arguments: makeObjectNode({
    lookup: makeFunctionNode(
      {
        parameter: types.string,
        return: types.option(types.string),
      },
      unserializableFunction,
      option.none,
      key => {
        if (typeof key !== 'string') {
          return either.makeLeft({
            kind: 'panic',
            message: 'key was not an atom',
          })
        } else {
          const { values: argumentValues } = parseArgs({
            args: process.argv,
            strict: false,
            options: {
              [key]: { type: 'string' },
            },
          })
          const argument = argumentValues[key]
          if (typeof argument !== 'string') {
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
                value: argument,
              }),
            )
          }
        }
      },
    ),
  }),
  environment: makeObjectNode({
    lookup: makeFunctionNode(
      {
        parameter: types.string,
        return: types.option(types.string),
      },
      unserializableFunction,
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
  log: makeFunctionNode(
    {
      parameter: types.something,
      return: types.object,
    },
    unserializableFunction,
    option.none,
    output => {
      const serializationResult = serialize(output)
      if (either.isLeft(serializationResult)) {
        return either.makeLeft({
          kind: 'panic',
          message: serializationResult.value.message,
        })
      } else {
        writeJSON(process.stderr, serializationResult.value)
        return either.makeRight(makeObjectNode({}))
      }
    },
  ),
  program: makeObjectNode({
    start_time: new Date().toISOString(),
  }),
})

export const handlers = {
  ...compilerKeywordHandlers,
  /**
   * Evaluates the given function, passing runtime context captured in `world`.
   */
  '@runtime': (expression): KeywordElaborationResult => {
    const runtimeFunction = lookupWithinExpression(
      ['function', '1'],
      expression,
    )
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

const lookupWithinExpression = (
  keyAliases: [Atom, ...(readonly Atom[])],
  expression: Expression,
): Option<SemanticGraph> => {
  for (const key of keyAliases) {
    const result = lookupPropertyOfObjectNode(key, expression)
    if (!option.isNone(result)) {
      return result
    }
  }
  return option.none
}
