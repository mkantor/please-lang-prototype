import { either, option, type Either } from '../../../../adts.js'
import type { ElaborationError } from '../../../errors.js'
import type { Molecule } from '../../../parsing.js'
import {
  isFunctionNode,
  makeUnelaboratedObjectNode,
} from '../../../semantics.js'
import {
  isExpression,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
} from '../../../semantics/expression-elaboration.js'
import { lookupPropertyOfObjectNode } from '../../../semantics/object-node.js'
import {
  stringifySemanticGraphForEndUser,
  type SemanticGraph,
  type unelaboratedKey,
} from '../../../semantics/semantic-graph.js'
import {
  asSemanticGraph,
  readArgumentsFromExpression,
} from './expression-utilities.js'

export const checkKeyword = '@check'

export type CheckExpression = Expression & {
  readonly 0: '@check'
  readonly value: SemanticGraph | Molecule
  readonly type: SemanticGraph | Molecule
}

export const readCheckExpression = (
  node: SemanticGraph,
): Either<ElaborationError, CheckExpression> =>
  isExpression(node)
    ? either.map(
        readArgumentsFromExpression(node, [
          ['value', '1'],
          ['type', '2'],
        ]),
        ([value, type]) => makeCheckExpression({ value, type }),
      )
    : either.makeLeft({
        kind: 'invalidExpression',
        message: 'not an expression',
      })

export const makeCheckExpression = ({
  value,
  type,
}: {
  value: SemanticGraph | Molecule
  type: SemanticGraph | Molecule
}): CheckExpression & { readonly [unelaboratedKey]: true } =>
  makeUnelaboratedObjectNode({
    0: '@check',
    value,
    type,
  })

export const checkKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readCheckExpression(expression), ({ value, type }) =>
    check({
      value: asSemanticGraph(value),
      type: asSemanticGraph(type),
      context,
    }),
  )

const check = ({
  context,
  value,
  type,
}: {
  readonly context: ExpressionContext
  readonly value: SemanticGraph
  readonly type: SemanticGraph
}): Either<ElaborationError, SemanticGraph> => {
  if (typeof type === 'string') {
    return typeof value === 'string' &&
      typeof type === 'string' &&
      value === type
      ? either.makeRight(value)
      : either.makeLeft({
          kind: 'typeMismatch',
          message: `the value \`${stringifySemanticGraphForEndUser(
            value,
          )}\` is not assignable to the type \`${stringifySemanticGraphForEndUser(
            type,
          )}\``,
        })
  } else if (isFunctionNode(value)) {
    // TODO: Model function signatures as data and allow checking them.
    return either.makeLeft({
      kind: 'invalidSyntaxTree',
      message: 'functions cannot be type checked',
    })
  } else if (isFunctionNode(type)) {
    const result = type(value)
    if (either.isLeft(result)) {
      // The compile-time-evaluated function panicked or had an unavailable dependency (which
      // results in a panic anyway in this context).
      return either.makeLeft({
        kind: 'panic',
        message: result.value.message,
      })
    } else if (typeof result.value !== 'string' || result.value !== 'true') {
      return either.makeLeft({
        kind: 'typeMismatch',
        message: `the value \`${stringifySemanticGraphForEndUser(
          value,
        )}\` did not pass the given type guard`,
      })
    } else {
      // The value was valid according to the type guard.
      return either.makeRight(value)
    }
  } else if (typeof value === 'string') {
    // The only remaining case is when the type is an object, so we must have a type error.
    return either.makeLeft({
      kind: 'typeMismatch',
      message: `the value \`${stringifySemanticGraphForEndUser(
        value,
      )}\` is not assignable to the type \`${stringifySemanticGraphForEndUser(
        type,
      )}\``,
    })
  } else {
    // Make sure all properties in the type are present and valid in the value (recursively).
    // Values may legally have additional properties beyond what is required by the type.
    for (const [key, typePropertyValue] of Object.entries(type)) {
      const valuePropertyValue = lookupPropertyOfObjectNode(key, value)
      if (option.isNone(valuePropertyValue)) {
        return either.makeLeft({
          kind: 'typeMismatch',
          message: `the value \`${stringifySemanticGraphForEndUser(
            value,
          )}\` is not assignable to the type \`${stringifySemanticGraphForEndUser(
            type,
          )}\` because it is missing the property \`${key}\``,
        })
      } else {
        // Recursively check the property:
        const resultOfCheckingProperty = check({
          context,
          value: valuePropertyValue.value,
          type: asSemanticGraph(typePropertyValue),
        })
        if (either.isLeft(resultOfCheckingProperty)) {
          return resultOfCheckingProperty
        }
      }
    }
    // If this function has not yet returned then the value is assignable to the type.
    return either.makeRight(value)
  }
}
