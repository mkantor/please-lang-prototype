import either, { type Either } from '@matt.kantor/either'
import option, { type Option } from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import type { Atom } from '../../../parsing.js'
import {
  applyKeyPathToSemanticGraph,
  asSemanticGraph,
  isExpression,
  isObjectNode,
  keyPathFromObjectNodeOrMolecule,
  keyPathToMolecule,
  makeLookupExpression,
  makeObjectNode,
  prelude,
  readFunctionExpression,
  readLookupExpression,
  stringifyKeyPathForEndUser,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'
import { inlinePlz, unparse } from '../../../unparsing.js'

export const lookupKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readLookupExpression(expression), ({ query }) =>
    either.flatMap(keyPathFromObjectNodeOrMolecule(query), relativePath => {
      if (isObjectNode(context.program)) {
        const key = relativePath[0] // TODO: Change `LookupExpression` to only accept a single key.
        if (key === undefined) {
          return either.makeLeft({
            kind: 'invalidExpression',
            message: 'key paths cannot be empty',
          })
        } else {
          return either.flatMap(lookup({ context, key }), possibleValue =>
            option.match(possibleValue, {
              none: () =>
                either.makeLeft({
                  kind: 'invalidExpression',
                  message: `property \`${stringifyKeyPathForEndUser(
                    relativePath,
                  )}\` not found`,
                }),
              some: either.makeRight,
            }),
          )
        }
      } else {
        return either.makeLeft({
          kind: 'invalidExpression',
          message: 'the program has no properties',
        })
      }
    }),
  )

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
    const pathToCurrentScope = context.location.slice(0, -1)

    const possibleLookedUpValue = option.flatMap(
      applyKeyPathToSemanticGraph(context.program, pathToCurrentScope),
      scope =>
        either.match(readFunctionExpression(scope), {
          left: _ =>
            // Lookups should not resolve to expression properties.
            // For example the lookup expression in `a => :parameter` (which is desugared to
            // `{@function parameter: a, body: {@lookup query: parameter}}`) should not resolve
            // to `a`.
            isExpression(scope)
              ? option.none
              : applyKeyPathToSemanticGraph(scope, [key]),
          right: functionExpression =>
            functionExpression.parameter === key
              ? // Keep an unelaborated `@lookup` around for resolution when the `@function` is called.
                option.makeSome(
                  makeLookupExpression(
                    makeObjectNode(keyPathToMolecule([key])),
                  ),
                )
              : option.none,
        }),
    )

    return option.match(possibleLookedUpValue, {
      none: () =>
        // Try the parent scope.
        lookup({
          key,
          context: {
            keywordHandlers: context.keywordHandlers,
            location: pathToCurrentScope,
            program: context.program,
          },
        }),
      some: lookedUpValue => either.makeRight(option.makeSome(lookedUpValue)),
    })
  }
}

const stringifyKeyForEndUser = (key: Atom): string =>
  either.match(unparse(key, inlinePlz), {
    right: stringifiedOutput => stringifiedOutput,
    left: error => `(unserializable key: ${error.message})`,
  })
