import { either, option, type Either } from '../../adts.js'
import type { ElaborationError } from '../../errors.js'
import type {
  ExpressionContext,
  KeywordElaborationResult,
  KeywordModule,
} from '../../semantics.js'
import {
  applyKeyPath,
  isAtomNode,
  isFunctionNode,
  isObjectNode,
  makeObjectNode,
  type KeyPath,
  type SemanticGraph,
} from '../../semantics.js'
import { serialize } from '../code-generation/serialization.js'
import { prelude } from './prelude.js'

const check = ({
  value,
  type,
}: {
  readonly value: SemanticGraph
  readonly type: SemanticGraph
}): Either<ElaborationError, SemanticGraph> => {
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
    const result = type.function(value)
    if (either.isLeft(result)) {
      // The compile-time-evaluated function panicked.
      return result
    }
    if (!isAtomNode(result.value) || result.value.atom !== 'true') {
      return either.makeLeft({
        kind: 'typeMismatch',
        message: `the value \`${stringifyGraphForEndUser(
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
      message: `the value \`${stringifyGraphForEndUser(
        value,
      )}\` is not assignable to the type \`${stringifyGraphForEndUser(type)}\``,
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
        const resultOfCheckingProperty = check({
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
}): Either<ElaborationError, SemanticGraph> => {
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
}

const todo = (): Either<ElaborationError, SemanticGraph> =>
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
        message:
          'function must be provided via a property named `function` or the first positional argument',
      })
    } else if (argument === undefined) {
      return either.makeLeft({
        kind: 'invalidExpression',
        message:
          'argument must be provided via a property named `argument` or the second positional argument',
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
  '@check': (expression): KeywordElaborationResult => {
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
      return check({ value, type })
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
          return lookup({
            context,
            relativePath: relativePathResult.value,
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
          'a function must be provided via a property named `function` or the first positional argument',
      })
    } else {
      return option.match(applyKeyPath(context.program, context.location), {
        none: () =>
          // this should not be possible
          either.makeLeft({
            kind: 'bug',
            message: 'failed to locate self in `@runtime` handler',
          }),
        some: valueFromProgram => either.makeRight(valueFromProgram),
      })
    }
  },

  /**
   * Ignores all arguments and evaluates to an empty object.
   */
  '@todo': todo,
} satisfies KeywordModule<`@${string}`>['handlers']

export type Keyword = keyof typeof handlers

// `isKeyword` is correct as long as `handlers` does not have excess properties.
const allKeywords = new Set(Object.keys(handlers))
export const isKeyword = (input: string): input is Keyword =>
  allKeywords.has(input)

const stringifyGraphForEndUser = (graph: SemanticGraph): string =>
  JSON.stringify(serialize(graph))
