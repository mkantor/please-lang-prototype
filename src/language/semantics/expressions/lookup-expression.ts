import either, { type Either } from '@matt.kantor/either'
import option, { type Option } from '@matt.kantor/option'
import type { ElaborationError } from '../../errors.js'
import type { Atom } from '../../parsing.js'
import type { ExpressionContext } from '../expression-elaboration.js'
import { isExpression, isKeywordExpressionWithArgument } from '../expression.js'
import {
  keyPathToMolecule,
  type KeyPath,
  type NonEmptyKeyPath,
} from '../key-path.js'
import { makeObjectNode, type ObjectNode } from '../object-node.js'
import { prelude } from '../prelude.js'
import {
  applyKeyPathToSemanticGraph,
  stringifySemanticGraphForEndUser,
  type SemanticGraph,
} from '../semantic-graph.js'
import {
  readArgumentsFromExpression,
  stringifyKeyForEndUser,
} from './expression-utilities.js'
import {
  getParameterName,
  readFunctionExpression,
} from './function-expression.js'
import { makeIndexExpression } from './index-expression.js'

export type LookupExpression = ObjectNode & {
  readonly 0: '@lookup'
  readonly 1: {
    readonly key: Atom
  }
}

export const readLookupExpression = (
  node: SemanticGraph,
): Either<ElaborationError, LookupExpression> =>
  isKeywordExpressionWithArgument('@lookup', node) ?
    either.flatMap(readArgumentsFromExpression(node, ['key']), ([key]) => {
      if (typeof key !== 'string') {
        return either.makeLeft({
          kind: 'invalidExpression',
          message: `lookup key must be an atom, got \`${stringifySemanticGraphForEndUser(
            key,
          )}\``,
        })
      } else {
        return either.makeRight(makeLookupExpression(key))
      }
    })
  : either.makeLeft({
      kind: 'invalidExpression',
      message: 'not a `@lookup` expression',
    })

export const makeLookupExpression = (key: Atom): LookupExpression =>
  makeObjectNode({
    0: '@lookup',
    1: makeObjectNode({ key }),
  })

export const keyPathToLookupExpression = (keyPath: NonEmptyKeyPath) => {
  const [initialKey, ...indexes] = keyPath
  const initialLookup = makeLookupExpression(initialKey)
  if (indexes.length === 0) {
    return initialLookup
  } else {
    return makeIndexExpression({
      object: initialLookup,
      query: makeObjectNode(keyPathToMolecule(indexes)),
    })
  }
}

/**
 * Recursively search upwards in lexical scope for the given `key`.
 */
export const lookup = ({
  context,
  key,
}: {
  readonly context: ExpressionContext
  readonly key: Atom
}): Either<ElaborationError, Option<SemanticGraph>> => {
  if (context.location.length === 0) {
    // Check the prelude.
    const valueFromPrelude = prelude[key]
    return valueFromPrelude === undefined ?
        either.makeLeft({
          kind: 'invalidExpression',
          message: `property \`${stringifyKeyForEndUser(key)}\` not found`,
        })
      : either.makeRight(option.makeSome(valueFromPrelude))
  } else {
    // Given the following program:
    // ```
    // {
    //  a1: …
    //  a2: {
    //    b1: …
    //    b2: … // we are here
    //  }
    // }
    // ```
    // If `context.location` is `['a2', 'b2']`, the current scope (containing
    // `b1`) is at `['a2']`, and the parent scope (containing `a1`) is at `[]`.
    const pathToCurrentScope = context.location.slice(0, -1)
    const pathToParentScope = pathToCurrentScope.slice(0, -1)

    // If parent is a keyword expression and the current scope's key is `1`, the
    // current scope is an expression argument.
    const expressionCurrentScopeIsArgumentOf = option.flatMap(
      option.filter(
        applyKeyPathToSemanticGraph(context.program, pathToParentScope),
        isExpression,
      ),
      parent =>
        pathToCurrentScope[pathToCurrentScope.length - 1] === '1' ?
          option.makeSome(parent)
        : option.none,
    )

    type LookupResult =
      | {
          readonly kind: 'found'
          readonly foundValue: SemanticGraph
        }
      | {
          readonly kind: 'notFound'
          readonly nextLocationToCheckFrom: KeyPath
        }

    const result: LookupResult = option.match(
      expressionCurrentScopeIsArgumentOf,
      {
        some: parentExpression => {
          const parentFunctionResult = readFunctionExpression(parentExpression)
          // If enclosed in a `@function` expression, allow looking up the
          // parameter.
          if (
            either.isRight(parentFunctionResult) &&
            getParameterName(parentFunctionResult.value) === key
          ) {
            // Keep an unelaborated `@lookup` around for resolution when the
            // `@function` is called.
            return {
              kind: 'found',
              foundValue: makeLookupExpression(key),
            }
          } else {
            return {
              kind: 'notFound',
              // Skip a level; don't consider expression properties as potential
              // `@lookup` targets.
              nextLocationToCheckFrom: pathToParentScope,
            }
          }
        },
        none: _ =>
          option.match(
            option.flatMap(
              applyKeyPathToSemanticGraph(context.program, pathToCurrentScope),
              currentScope => applyKeyPathToSemanticGraph(currentScope, [key]),
            ),
            {
              some: foundValue => ({
                kind: 'found',
                foundValue,
              }),
              none: _ => ({
                kind: 'notFound',
                nextLocationToCheckFrom: pathToCurrentScope,
              }),
            },
          ),
      },
    )

    if (result.kind === 'found') {
      return either.makeRight(option.makeSome(result.foundValue))
    } else {
      // Try the parent scope.
      return lookup({
        key,
        context: {
          keywordHandlers: context.keywordHandlers,
          location: result.nextLocationToCheckFrom,
          program: context.program,
        },
      })
    }
  }
}
