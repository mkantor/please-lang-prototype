import { either, option, type Either, type Option } from '../../../adts.js'
import type { ElaborationError } from '../../errors.js'
import type { Atom, Molecule } from '../../parsing.js'
import {
  isAssignable,
  isFunctionNode,
  isObjectNode,
  makeObjectNode,
  replaceAllTypeParametersWithTheirConstraints,
  serialize,
  types,
  type ExpressionContext,
  type KeyPath,
  type KeywordElaborationResult,
  type KeywordModule,
  type ObjectNode,
  type SemanticGraph,
} from '../../semantics.js'
import { stringifyKeyPathForEndUser } from '../../semantics/key-path.js'
import {
  lookupPropertyOfObjectNode,
  makeUnelaboratedObjectNode,
} from '../../semantics/object-node.js'
import {
  applyKeyPathToSemanticGraph,
  containsAnyUnelaboratedNodes,
} from '../../semantics/semantic-graph.js'
import { prelude } from './prelude.js'

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
    }
    if (typeof result.value !== 'string' || result.value !== 'true') {
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

const lookup = ({
  context,
  relativePath,
}: {
  readonly context: ExpressionContext
  readonly relativePath: KeyPath
}): Either<ElaborationError, Option<SemanticGraph>> => {
  const [firstPathComponent, ...propertyPath] = relativePath
  if (firstPathComponent === undefined) {
    // TODO Consider allowing empty paths, emitting a "hole" of type `nothing` (like `???` in
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
      },
    )

    return either.flatMap(resultForCurrentScope, possibleLookedUpValue =>
      option.match(possibleLookedUpValue, {
        none: () =>
          // Try the parent scope.
          lookup({
            relativePath,
            context: { program: context.program, location: pathToCurrentScope },
          }),
        some: lookedUpValue => either.makeRight(option.makeSome(lookedUpValue)),
      }),
    )
  }
}

const todo = (): Either<ElaborationError, SemanticGraph> =>
  either.makeRight(makeObjectNode({}))

export const handlers = {
  /**
   * Calls the given `FunctionNode` with a given argument.
   */
  '@apply': (expression, _context): KeywordElaborationResult => {
    const functionToApply = lookupWithinArgument(['function', '1'], expression)
    const argument = lookupWithinArgument(['argument', '2'], expression)

    if (option.isNone(functionToApply)) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'function must be provided via the property `function` or `1`',
      })
    } else if (option.isNone(argument)) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'argument must be provided via the property `argument` or `2`',
      })
    } else {
      if (containsAnyUnelaboratedNodes(argument.value)) {
        // The argument isn't ready, so keep this unelaborated.
        return either.makeRight(
          makeUnelaboratedObjectNode({
            0: '@apply',
            1: functionToApply.value,
            2: argument.value,
          }),
        )
      } else if (isFunctionNode(functionToApply.value)) {
        const result = functionToApply.value(argument.value)
        if (either.isLeft(result)) {
          if (result.value.kind === 'dependencyUnavailable') {
            // Keep the @apply unelaborated.
            return either.makeRight(
              makeUnelaboratedObjectNode({
                0: '@apply',
                1: functionToApply.value,
                2: argument.value,
              }),
            )
          } else {
            return either.makeLeft(result.value)
          }
        } else {
          return result
        }
      } else if (containsAnyUnelaboratedNodes(functionToApply.value)) {
        // The function isn't ready, so keep this unelaborated.
        return either.makeRight(
          makeUnelaboratedObjectNode({
            0: '@apply',
            1: functionToApply.value,
            2: argument.value,
          }),
        )
      } else {
        return either.makeLeft({
          kind: 'invalidExpression',
          message: 'only functions can be applied',
        })
      }
    }
  },

  /**
   * Checks whether a given value is assignable to a given type.
   */
  '@check': (expression, context): KeywordElaborationResult => {
    const value = lookupWithinArgument(['value', '1'], expression)
    const type = lookupWithinArgument(['type', '2'], expression)
    if (option.isNone(value)) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'value must be provided via the property `value` or `1`',
      })
    } else if (option.isNone(type)) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'type must be provided via the property `type` or `2`',
      })
    } else {
      return check({
        value: value.value,
        type: type.value,
        context,
      })
    }
  },

  /**
   * Given a query, resolves the value of a property within the program.
   */
  '@lookup': (expression, context): KeywordElaborationResult => {
    const query = lookupWithinArgument(['query', '1'], expression)
    if (option.isNone(query)) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'query must be provided via the property `query` or `1`',
      })
    } else if (isFunctionNode(query.value)) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'query cannot be a function',
      })
    } else {
      const canonicalizedQuery =
        typeof query.value === 'string'
          ? makeObjectNode({ 0: query.value })
          : query.value
      const relativePathResult: Either<ElaborationError, readonly string[]> =
        (() => {
          const relativePath: string[] = []
          let queryIndex = 0
          // Consume numeric indexes ("0", "1", …) until exhausted, validating that each is an atom.
          let node = canonicalizedQuery[queryIndex]
          while (node !== undefined) {
            if (typeof node !== 'string') {
              return either.makeLeft({
                kind: 'invalidExpression',
                message:
                  'query must be a key path composed of sequential atoms',
              })
            } else {
              relativePath.push(node)
            }
            queryIndex++
            node = canonicalizedQuery[queryIndex]
          }
          return either.makeRight(relativePath)
        })()

      if (either.isLeft(relativePathResult)) {
        return relativePathResult
      } else {
        if (isObjectNode(context.program)) {
          return either.flatMap(
            lookup({
              context,
              relativePath: relativePathResult.value,
            }),
            possibleValue =>
              option.match(possibleValue, {
                none: () =>
                  either.makeLeft({
                    kind: 'invalidExpression',
                    message: `property \`${stringifyKeyPathForEndUser(
                      relativePathResult.value,
                    )}\` not found`,
                  }),
                some: either.makeRight,
              }),
          )
        } else {
          // TODO: Support looking up function parameter, etc?
          return either.makeLeft({
            kind: 'invalidExpression',
            message: 'the program has no properties',
          })
        }
      }
    }
  },

  /**
   * Preserves a raw function node for emission into the runtime code.
   */
  '@runtime': (expression, context): KeywordElaborationResult => {
    const runtimeFunction = lookupWithinArgument(['function', '1'], expression)
    if (
      option.isNone(runtimeFunction) ||
      !(
        isFunctionNode(runtimeFunction.value) ||
        containsAnyUnelaboratedNodes(runtimeFunction.value)
      )
    ) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message:
          'a function must be provided via the property `function` or `1`',
      })
    } else if (isFunctionNode(runtimeFunction.value)) {
      const runtimeFunctionSignature = runtimeFunction.value.signature
      return either.flatMap(locateSelf(context), valueFromProgram =>
        !isAssignable({
          source: types.runtimeContext,
          target: replaceAllTypeParametersWithTheirConstraints(
            runtimeFunctionSignature.parameter,
          ),
        })
          ? either.makeLeft({
              kind: 'typeMismatch',
              message:
                '@runtime function must accept a runtime context argument',
            })
          : either.makeRight(valueFromProgram),
      )
    } else {
      // TODO: Type-check unelaborated nodes.
      return locateSelf(context)
    }
  },

  /**
   * Ignores operand and evaluates to an empty object.
   */
  '@todo': todo,
} satisfies KeywordModule<`@${string}`>['handlers']

export type Keyword = keyof typeof handlers

// `isKeyword` is correct as long as `handlers` does not have excess properties.
const allKeywords = new Set(Object.keys(handlers))
export const isKeyword = (input: string): input is Keyword =>
  allKeywords.has(input)

const asSemanticGraph = (
  possiblyUnelaboratedValue: SemanticGraph | Molecule,
): SemanticGraph =>
  typeof possiblyUnelaboratedValue === 'object'
    ? makeObjectNode(possiblyUnelaboratedValue)
    : possiblyUnelaboratedValue

const locateSelf = (context: ExpressionContext) =>
  option.match(applyKeyPathToSemanticGraph(context.program, context.location), {
    none: () =>
      either.makeLeft({
        kind: 'bug',
        message: `failed to locate self at \`${stringifyKeyPathForEndUser(
          context.location,
        )}\` in program`,
      }),
    some: either.makeRight,
  })

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

const stringifySemanticGraphForEndUser = (graph: SemanticGraph): string =>
  JSON.stringify(serialize(graph))
