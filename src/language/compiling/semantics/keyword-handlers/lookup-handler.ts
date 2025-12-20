import either, { type Either } from '@matt.kantor/either'
import option, { type Option } from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import type { Atom } from '../../../parsing.js'
import {
  applyKeyPathToSemanticGraph,
  asSemanticGraph,
  isExpression,
  isObjectNode,
  makeLookupExpression,
  prelude,
  readFunctionExpression,
  readLookupExpression,
  type Expression,
  type ExpressionContext,
  type KeyPath,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'
import { inlinePlz, unparse } from '../../../unparsing.js'

export const lookupKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readLookupExpression(expression), ({ 1: { key } }) => {
    if (isObjectNode(context.program)) {
      return either.flatMap(lookup({ context, key }), possibleValue =>
        option.match(possibleValue, {
          none: () =>
            either.makeLeft({
              kind: 'invalidExpression',
              message: `property \`${stringifyKeyForEndUser(key)}\` not found`,
            }),
          some: either.makeRight,
        }),
      )
    } else {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'the program has no properties',
      })
    }
  })

/**
 * Recursively search upwards in lexical scope for the given `key`.
 */
const lookup = ({
  context,
  key,
}: {
  readonly context: ExpressionContext
  readonly key: Atom
}): Either<ElaborationError, Option<SemanticGraph>> => {
  if (context.location.length === 0) {
    // Check the prelude.
    const valueFromPrelude = prelude[key]
    return valueFromPrelude === undefined
      ? either.makeLeft({
          kind: 'invalidExpression',
          message: `property \`${stringifyKeyForEndUser(key)}\` not found`,
        })
      : either.makeRight(option.makeSome(asSemanticGraph(valueFromPrelude)))
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
        pathToCurrentScope[pathToCurrentScope.length - 1] === '1'
          ? option.makeSome(parent)
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
            parentFunctionResult.value[1].parameter === key
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

const stringifyKeyForEndUser = (key: Atom): string =>
  either.match(unparse(key, inlinePlz), {
    right: stringifiedOutput => stringifiedOutput,
    left: error => `(unserializable key: ${error.message})`,
  })
