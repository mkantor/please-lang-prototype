import either, { type Either } from '@matt.kantor/either'
import option, { type Option } from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import {
  applyKeyPathToSemanticGraph,
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
  type KeyPath,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'

export const lookupKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readLookupExpression(expression), ({ query }) =>
    either.flatMap(keyPathFromObjectNodeOrMolecule(query), relativePath => {
      if (isObjectNode(context.program)) {
        return either.flatMap(
          lookup({
            context,
            relativePath,
          }),
          possibleValue =>
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
  relativePath,
}: {
  readonly context: ExpressionContext
  readonly relativePath: KeyPath
}): Either<ElaborationError, Option<SemanticGraph>> => {
  const [firstPathComponent, ...propertyPath] = relativePath
  if (firstPathComponent === undefined) {
    // TODO: Consider allowing empty paths, emitting a "hole" of type `nothing` (like `???` in
    // Scala, `todo!()` in Rust, `?foo` in Idris, etc).
    return either.makeLeft({
      kind: 'invalidExpression',
      message: 'key paths cannot be empty',
    })
  }
  if (context.location.length === 0) {
    // Check the prelude.
    return option.match(applyKeyPathToSemanticGraph(prelude, relativePath), {
      none: () =>
        either.makeLeft({
          kind: 'invalidExpression',
          message: `property \`${stringifyKeyPathForEndUser(
            relativePath,
          )}\` not found`,
        }),
      some: valueFromPrelude =>
        either.makeRight(option.makeSome(valueFromPrelude)),
    })
  } else {
    const pathToCurrentScope = context.location.slice(0, -1)

    const resultForCurrentScope: Either<
      ElaborationError,
      Option<SemanticGraph>
    > = option.match(
      applyKeyPathToSemanticGraph(context.program, pathToCurrentScope),
      {
        none: () => either.makeRight(option.none),
        some: scope =>
          either.match(readFunctionExpression(scope), {
            left: _ =>
              option.match(
                applyKeyPathToSemanticGraph(scope, [firstPathComponent]),
                {
                  none: () => either.makeRight(option.none),
                  some: property =>
                    option.match(
                      applyKeyPathToSemanticGraph(property, propertyPath),
                      {
                        none: () =>
                          either.makeLeft({
                            kind: 'invalidExpression',
                            message: `\`${stringifyKeyPathForEndUser(
                              propertyPath,
                            )}\` is not a property of \`${stringifyKeyPathForEndUser(
                              [...pathToCurrentScope, firstPathComponent],
                            )}\``,
                          }),
                        some: lookedUpValue =>
                          either.makeRight(option.makeSome(lookedUpValue)),
                      },
                    ),
                },
              ),
            right: functionExpression => {
              if (functionExpression.parameter === firstPathComponent) {
                // Keep an unelaborated `@lookup` around for resolution when the `@function` is called.
                return either.makeRight(
                  option.makeSome(
                    makeLookupExpression(
                      makeObjectNode(keyPathToMolecule(relativePath)),
                    ),
                  ),
                )
              } else {
                return either.makeRight(option.none)
              }
            },
          }),
      },
    )

    return either.flatMap(resultForCurrentScope, possibleLookedUpValue =>
      option.match(possibleLookedUpValue, {
        none: () =>
          // Try the parent scope.
          lookup({
            relativePath,
            context: {
              keywordHandlers: context.keywordHandlers,
              location: pathToCurrentScope,
              program: context.program,
            },
          }),
        some: lookedUpValue => either.makeRight(option.makeSome(lookedUpValue)),
      }),
    )
  }
}
