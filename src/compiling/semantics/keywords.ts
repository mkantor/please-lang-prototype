import type { Either } from '../../adts/either.js'
import * as either from '../../adts/either.js'
import * as option from '../../adts/option.js'
import { serialize } from '../code-generation/serialization.js'
import type { ElaborationError } from '../errors.js'
import { prelude } from './prelude.js'
import {
  applyKeyPath,
  isAtomNode,
  isFunctionNode,
  isObjectNode,
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
    if (isAtomNode(type)) {
      return isAtomNode(value) && isAtomNode(type) && value.atom === type.atom
        ? either.makeRight(value)
        : either.makeLeft({
            kind: 'typeMismatch',
            message: `the value \`${stringifyGraphForEndUser(
              value,
            )}\` is not assignable to the type \`${stringifyGraphForEndUser(
              type,
            )}\``,
          })
    } else if (isFunctionNode(value)) {
      // TODO: model function signatures as data and allow checking them
      return either.makeLeft({
        kind: 'invalidSyntax',
        message: 'functions cannot be type checked',
      })
    } else if (isFunctionNode(type)) {
      // TODO: if the function is a predicate, call it to check the value
      return either.makeLeft({
        kind: 'invalidSyntax',
        message: 'functions cannot be used as types',
      })
    } else if (isAtomNode(value)) {
      // The only remaining case is when the type is an object, so we must have a type error.
      return either.makeLeft({
        kind: 'typeMismatch',
        message: `the value \`${stringifyGraphForEndUser(
          value,
        )}\` is not assignable to the type \`${stringifyGraphForEndUser(
          type,
        )}\``,
      })
    } else {
      // Make sure all properties in the type are present and valid in the value (recursively).
      // Values may legally have additional properties beyond what is required by the type.
      for (const [key, typePropertyValue] of Object.entries(type.children)) {
        if (value.children[key] === undefined) {
          return either.makeLeft({
            kind: 'typeMismatch',
            message: `the value \`${stringifyGraphForEndUser(
              value,
            )}\` is not assignable to the type \`${stringifyGraphForEndUser(
              type,
            )}\` because it is missing the property \`${key}\``,
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
   * Resolves to the value of a property within the program.
   */
  lookup: ({
    context,
    relativePath,
  }: {
    readonly context: ExpressionContext
    readonly relativePath: KeyPath
  }): ReturnType<KeywordHandler> => {
    const pathToLocalScope = context.location.slice(0, -1)
    const absolutePath = [...pathToLocalScope, ...relativePath]
    return option.match(applyKeyPath(context.program, absolutePath), {
      none: () =>
        option.match(applyKeyPath(prelude, relativePath), {
          none: () =>
            either.makeLeft({
              kind: 'invalidExpression',
              message: 'property not found',
            }),
          some: valueFromPrelude => either.makeRight(valueFromPrelude),
        }),
      some: valueFromProgram => either.makeRight(valueFromProgram),
    })
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

  '@lookup': (expression, context) => {
    const query = expression.children.query ?? expression.children['1']
    if (query === undefined) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message:
          'selector must be provided via a property named `query` or the first positional argument',
      })
    } else if (!isObjectNode(query)) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'selector must be an object',
      })
    } else {
      const relativePathResult: Either<ElaborationError, readonly string[]> =
        (() => {
          const relativePath: string[] = []
          let queryIndex = 0
          // Consume numeric indexes ("0", "1", …) until exhausted, validating that each is an atom.
          let node = query.children[queryIndex]
          while (node !== undefined) {
            if (!isAtomNode(node)) {
              return either.makeLeft({
                kind: 'invalidExpression',
                message:
                  'query must be a key path composed of sequential atoms',
              })
            } else {
              relativePath.push(node.atom)
            }
            queryIndex++
            node = query.children[queryIndex]
          }
          return either.makeRight(relativePath)
        })()

      if (either.isLeft(relativePathResult)) {
        return relativePathResult
      } else {
        if (!isObjectNode(context.program)) {
          return either.makeLeft({
            kind: 'invalidExpression',
            message:
              'the program is not an object, so there are no properties to look up',
          })
        } else {
          return handlers.lookup({
            context,
            relativePath: relativePathResult.value,
          })
        }
      }
    }
  },

  '@todo': handlers.todo,
} satisfies Record<`@${string}`, KeywordHandler>

export type Keyword = keyof typeof keywordTransforms

// `isKeyword` is correct as long as `keywordTransforms` does not have excess properties.
const allKeywords = new Set(Object.keys(keywordTransforms))
export const isKeyword = (input: unknown): input is Keyword =>
  typeof input === 'string' && allKeywords.has(input)

const stringifyGraphForEndUser = (graph: SemanticGraph): string =>
  JSON.stringify(serialize(graph))
