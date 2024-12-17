import { either, option, type Either, type Option } from '../../../../adts.js'
import type {
  ElaborationError,
  InvalidExpressionError,
} from '../../../errors.js'
import {
  makeLookupExpression,
  readFunctionExpression,
  readLookupExpression,
  type Expression,
  type KeyPath,
} from '../../../semantics.js'
import {
  type ExpressionContext,
  type KeywordHandler,
} from '../../../semantics/expression-elaboration.js'
import {
  keyPathToMolecule,
  stringifyKeyPathForEndUser,
} from '../../../semantics/key-path.js'
import {
  isObjectNode,
  makeObjectNode,
  type ObjectNode,
} from '../../../semantics/object-node.js'
import {
  applyKeyPathToSemanticGraph,
  type SemanticGraph,
} from '../../../semantics/semantic-graph.js'
import { prelude } from '../prelude.js'

export const lookupKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readLookupExpression(expression), ({ query }) =>
    either.flatMap(keyPathFromObjectNode(query), relativePath => {
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

const keyPathFromObjectNode = (
  node: ObjectNode,
): Either<InvalidExpressionError, KeyPath> => {
  const relativePath: string[] = []
  let queryIndex = 0
  // Consume numeric indexes ("0", "1", …) until exhausted, validating that each is an atom.
  let key = node[queryIndex]
  while (key !== undefined) {
    if (typeof key !== 'string') {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'query must be a key path composed of sequential atoms',
      })
    } else {
      relativePath.push(key)
    }
    queryIndex++
    key = node[queryIndex]
  }
  return either.makeRight(relativePath)
}

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
                if (!relativePath.every(key => typeof key === 'string')) {
                  return either.makeLeft({
                    kind: 'invalidExpression',
                    message:
                      'dynamically-resolved lookup query contains symbolic key',
                  })
                } else {
                  // Keep an unelaborated `@lookup` around for resolution when the `@function` is called.
                  return either.makeRight(
                    option.makeSome(
                      makeLookupExpression(
                        makeObjectNode(keyPathToMolecule(relativePath)),
                      ),
                    ),
                  )
                }
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
