import { either, option, type Either, type Option } from '../../../adts.js'
import type { ElaborationError } from '../../errors.js'
import {
  isAssignable,
  isAtomNode,
  isFunctionNode,
  isObjectNode,
  isPartiallyElaboratedObjectNode,
  makeObjectNode,
  replaceAllTypeParametersWithTheirConstraints,
  serialize,
  types,
  type ExpressionContext,
  type FullyElaboratedSemanticGraph,
  type KeyPath,
  type KeywordElaborationResult,
  type KeywordModule,
} from '../../semantics.js'
import { stringifyKeyPathForEndUser } from '../../semantics/key-path.js'
import {
  applyKeyPathToPartiallyElaboratedSemanticGraph,
  isPartiallyElaboratedSemanticGraph,
  type PartiallyElaboratedSemanticGraph,
} from '../../semantics/semantic-graph.js'
import { prelude } from './prelude.js'

const check = ({
  context,
  value,
  type,
}: {
  readonly context: ExpressionContext
  readonly value: FullyElaboratedSemanticGraph
  readonly type: PartiallyElaboratedSemanticGraph
}): Either<ElaborationError, PartiallyElaboratedSemanticGraph> => {
  if (isAtomNode(type)) {
    return isAtomNode(value) && isAtomNode(type) && value.atom === type.atom
      ? either.makeRight(value)
      : either.makeLeft({
          kind: 'typeMismatch',
          message: `the value \`${stringifyPartiallyElaboratedSemanticGraphForEndUser(
            value,
          )}\` is not assignable to the type \`${stringifyPartiallyElaboratedSemanticGraphForEndUser(
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
    const result = type.function(value)
    if (either.isLeft(result)) {
      // The compile-time-evaluated function panicked.
      return result
    }
    if (!isAtomNode(result.value) || result.value.atom !== 'true') {
      return either.makeLeft({
        kind: 'typeMismatch',
        message: `the value \`${stringifyPartiallyElaboratedSemanticGraphForEndUser(
          value,
        )}\` did not pass the given type guard`,
      })
    } else {
      // The value was valid according to the type guard.
      return either.makeRight(value)
    }
  } else if (isAtomNode(value)) {
    // The only remaining case is when the type is an object, so we must have a type error.
    return either.makeLeft({
      kind: 'typeMismatch',
      message: `the value \`${stringifyPartiallyElaboratedSemanticGraphForEndUser(
        value,
      )}\` is not assignable to the type \`${stringifyPartiallyElaboratedSemanticGraphForEndUser(
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
          message: `the value \`${stringifyPartiallyElaboratedSemanticGraphForEndUser(
            value,
          )}\` is not assignable to the type \`${stringifyPartiallyElaboratedSemanticGraphForEndUser(
            type,
          )}\` because it is missing the property \`${key}\``,
        })
      } else if (!isPartiallyElaboratedSemanticGraph(typePropertyValue)) {
        // TODO: Eliminate this case if `PartiallyElaboratedSemanticGraph` is generalized to be a
        // subtype of `Molecule | Atom`.
        return either.makeLeft({
          kind: 'invalidExpression',
          message: `the value of the property \`${key}\` was not a semantic graph`,
        })
      } else {
        // Recursively check the property:
        const resultOfCheckingProperty = check({
          context,
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
}

const lookup = ({
  context,
  relativePath,
}: {
  readonly context: ExpressionContext
  readonly relativePath: KeyPath
}): Either<ElaborationError, Option<PartiallyElaboratedSemanticGraph>> => {
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
    return option.match(
      applyKeyPathToPartiallyElaboratedSemanticGraph(prelude, relativePath),
      {
        none: () =>
          either.makeLeft({
            kind: 'invalidExpression',
            message: `property \`${stringifyKeyPathForEndUser(
              relativePath,
            )}\` not found`,
          }),
        some: valueFromPrelude =>
          either.makeRight(option.makeSome(valueFromPrelude)),
      },
    )
  } else {
    const pathToCurrentScope = context.location.slice(0, -1)

    const resultForCurrentScope: Either<
      ElaborationError,
      Option<PartiallyElaboratedSemanticGraph>
    > = option.match(
      applyKeyPathToPartiallyElaboratedSemanticGraph(
        context.program,
        pathToCurrentScope,
      ),
      {
        none: () => either.makeRight(option.none),
        some: scope =>
          option.match(
            applyKeyPathToPartiallyElaboratedSemanticGraph(scope, [
              firstPathComponent,
            ]),
            {
              none: () => either.makeRight(option.none),
              some: property =>
                option.match(
                  applyKeyPathToPartiallyElaboratedSemanticGraph(
                    property,
                    propertyPath,
                  ),
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

const todo = (): Either<ElaborationError, PartiallyElaboratedSemanticGraph> =>
  either.makeRight(makeObjectNode({}))

export const handlers = {
  /**
   * Calls the given `FunctionNode` with a given argument.
   */
  '@apply': (expression, _context): KeywordElaborationResult => {
    const functionToApply =
      expression.children['function'] ?? expression.children['1']
    const argument = expression.children.argument ?? expression.children['2']

    if (functionToApply === undefined) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'function must be provided via the property `function` or `1`',
      })
    } else if (argument === undefined) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'argument must be provided via the property `argument` or `2`',
      })
    } else if (!isFunctionNode(functionToApply)) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'only functions can be applied',
      })
    } else {
      return functionToApply.function(argument)
    }
  },

  /**
   * Checks whether a given value is assignable to a given type.
   */
  '@check': (expression, context): KeywordElaborationResult => {
    const value = expression.children.value ?? expression.children['1']
    const type = expression.children.type ?? expression.children['2']
    if (value === undefined) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'value must be provided via the property `value` or `1`',
      })
    } else if (type === undefined) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'type must be provided via the property `type` or `2`',
      })
    } else {
      return check({ value, type, context })
    }
  },

  /**
   * Given a query, resolves the value of a property within the program.
   */
  '@lookup': (expression, context): KeywordElaborationResult => {
    const query = expression.children.query ?? expression.children['1']
    if (query === undefined) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'query must be provided via the property `query` or `1`',
      })
    } else if (!isObjectNode(query) && !isAtomNode(query)) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'query must be an object',
      })
    } else {
      const canonicalizedQuery = isAtomNode(query)
        ? makeObjectNode({ 0: query })
        : query
      const relativePathResult: Either<ElaborationError, readonly string[]> =
        (() => {
          const relativePath: string[] = []
          let queryIndex = 0
          // Consume numeric indexes ("0", "1", …) until exhausted, validating that each is an atom.
          let node = canonicalizedQuery.children[queryIndex]
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
            node = canonicalizedQuery.children[queryIndex]
          }
          return either.makeRight(relativePath)
        })()

      if (either.isLeft(relativePathResult)) {
        return relativePathResult
      } else {
        if (isPartiallyElaboratedObjectNode(context.program)) {
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
    const runtimeFunction =
      expression.children.function ?? expression.children['1']
    if (runtimeFunction === undefined || !isFunctionNode(runtimeFunction)) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message:
          'a function must be provided via the property `function` or `1`',
      })
    } else {
      return either.flatMap(locateSelf(context), valueFromProgram =>
        !isAssignable({
          source: types.runtimeContext,
          target: replaceAllTypeParametersWithTheirConstraints(
            runtimeFunction.signature.signature.parameter,
          ),
        })
          ? either.makeLeft({
              kind: 'typeMismatch',
              message:
                '@runtime function must accept a runtime context argument',
            })
          : either.makeRight(valueFromProgram),
      )
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

const locateSelf = (context: ExpressionContext) =>
  option.match(
    applyKeyPathToPartiallyElaboratedSemanticGraph(
      context.program,
      context.location,
    ),
    {
      none: () =>
        either.makeLeft({
          kind: 'bug',
          message: `failed to locate self at \`${stringifyKeyPathForEndUser(
            context.location,
          )}\` in program`,
        }),
      some: either.makeRight,
    },
  )

const stringifyPartiallyElaboratedSemanticGraphForEndUser = (
  graph: PartiallyElaboratedSemanticGraph,
): string => JSON.stringify(serialize(graph))
