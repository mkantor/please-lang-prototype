import type { Either } from '../../adts/either.js'
import * as either from '../../adts/either.js'
import type { ElaborationError } from '../errors.js'
import {
  isAtomNode,
  makeObjectNode,
  type KeyPath,
  type ObjectNode,
  type SemanticGraph,
} from './semantic-graph.js'

export type ExpressionContext = {
  readonly program: SemanticGraph
  readonly location: KeyPath
}

type KeywordHandler = (
  expression: ObjectNode,
  context: ExpressionContext,
) => Either<ElaborationError, SemanticGraph>

const handlers = {
  /**
   * Checks whether a given value is assignable to a given type.
   */
  check: ({
    value,
    type,
  }: {
    readonly value: SemanticGraph
    readonly type: SemanticGraph
  }): ReturnType<KeywordHandler> => {
    if (isAtomNode(value) || isAtomNode(type)) {
      return isAtomNode(value) && isAtomNode(type) && value.atom === type.atom
        ? either.makeRight(value)
        : either.makeLeft({
            kind: 'typeMismatch',
            message: `the value \`${JSON.stringify(
              value,
            )}\` is not assignable to the type \`${JSON.stringify(type)}\``,
          })
    } else {
      // Make sure all properties in the type are present and valid in the value (recursively).
      // Values may legally have additional properties beyond what is required by the type.
      for (const [key, typePropertyValue] of Object.entries(type.children)) {
        if (value.children[key] === undefined) {
          return either.makeLeft({
            kind: 'typeMismatch',
            message: `the value \`${JSON.stringify(
              value,
            )}\` is not assignable to the type \`${JSON.stringify(
              type,
            )}\` because it is missing the property \`${JSON.stringify(key)}\``,
          })
        } else {
          // Recursively check the property:
          const resultOfCheckingProperty = handlers.check({
            value: value.children[key],
            type: typePropertyValue,
          })
          if (either.isLeft(resultOfCheckingProperty)) {
            return resultOfCheckingProperty
          }
        }
      }
      // If this function has not yet returned then the value is assignable to the type.
      return either.makeRight(value)
    }
  },
  /**
   * Ignores all arguments and evaluates to an empty object.
   */
  todo: (): ReturnType<KeywordHandler> => either.makeRight(makeObjectNode({})),
}

export const keywordTransforms = {
  '@check': (expression, _context) => {
    const value = expression.children.value ?? expression.children['1']
    const type = expression.children.type ?? expression.children['2']
    if (value === undefined) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message:
          'value must be provided via a property named `value` or the first positional argument',
      })
    } else if (type === undefined) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message:
          'type must be provided via a property named `type` or the second positional argument',
      })
    } else {
      return handlers.check({ value, type })
    }
  },
  '@todo': handlers.todo,
} satisfies Record<`@${string}`, KeywordHandler>

export type Keyword = keyof typeof keywordTransforms

// `isKeyword` is correct as long as `keywordTransforms` does not have excess properties.
const allKeywords = new Set(Object.keys(keywordTransforms))
export const isKeyword = (input: unknown): input is Keyword =>
  typeof input === 'string' && allKeywords.has(input)
