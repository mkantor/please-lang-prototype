import {
  lazy,
  map,
  nothing,
  oneOf,
  oneOrMore,
  sequence,
  zeroOrMore,
  type Parser,
} from '@matt.kantor/parsing'
import type { Writable } from '../../utility-types.js'
import { keyPathToMolecule, type KeyPath } from '../semantics.js'
import {
  atom,
  atomWithAdditionalQuotationRequirements,
  unquotedAtomParser,
  type Atom,
} from './atom.js'
import {
  arrow,
  atSign,
  closingBrace,
  colon,
  comma,
  dot,
  newline,
  openingBrace,
} from './literals.js'
import {
  optionallySurroundedByParentheses,
  surroundedByParentheses,
} from './parentheses.js'
import { optionalTrivia, trivia, triviaExceptNewlines } from './trivia.js'

export type Molecule = { readonly [key: Atom]: Molecule | Atom }

// Keyless properties are automatically assigned numeric indexes, which uses some mutable state.
type Indexer = () => string
const makeIncrementingIndexer = (): Indexer => {
  const state = { currentIndex: 0n }
  return () => {
    const index = state.currentIndex
    // TODO: Consider using a `State` monad or something instead of mutation.
    state.currentIndex += 1n
    return String(index)
  }
}

const optional = <Output>(
  parser: Parser<NonNullable<Output>>,
): Parser<Output | undefined> => oneOf([parser, nothing])

const trailingIndexesAndArgumentsToExpression = (
  root: Atom | Molecule,
  trailingIndexesAndArguments: readonly TrailingIndexOrArgument[],
) =>
  trailingIndexesAndArguments.reduce((expression, indexOrArgument) => {
    switch (indexOrArgument.kind) {
      case 'argument':
        return {
          0: '@apply',
          1: {
            function: expression,
            argument: indexOrArgument.argument,
          },
        }
      case 'index':
        return {
          0: '@index',
          1: {
            object: expression,
            query: keyPathToMolecule(indexOrArgument.query),
          },
        }
    }
  }, root)

type InfixOperator = readonly [Atom, readonly TrailingIndexOrArgument[]]
type InfixOperand = Atom | Molecule
type InfixToken = InfixOperator | InfixOperand

/**
 * Infix operations should be of the following form:
 * ```
 * [InfixOperand, InfixOperator, InfixOperand, InfixOperator, …, InfixOperand]
 * ```
 * However this can't be directly modeled in TypeScript.
 */
type InfixOperation = readonly [InfixToken, ...InfixToken[]]

const isOperand = (value: InfixToken | undefined): value is InfixOperand =>
  !Array.isArray(value)
const isOperator = (value: InfixToken | undefined): value is InfixOperator =>
  Array.isArray(value)

const infixTokensToExpression = (
  operation: InfixOperation,
): Molecule | Atom => {
  const firstToken = operation[0]
  if (operation.length === 1 && isOperand(firstToken)) {
    return firstToken
  } else {
    const leftmostOperationLHS = operation[0]
    if (leftmostOperationLHS === undefined) {
      throw new Error('Infix operation was empty. This is a bug!')
    }
    if (!isOperand(leftmostOperationLHS)) {
      throw new Error(
        'Leftmost token in infix operation was not an operand. This is a bug!',
      )
    }

    const leftmostOperator = operation[1]
    if (!isOperator(leftmostOperator)) {
      throw new Error(
        'Could not find leftmost operator in infix operation. This is a bug!',
      )
    }

    const leftmostOperationRHS = operation[2]
    if (!isOperand(leftmostOperationRHS)) {
      throw new Error(
        'Missing right-hand side of infix operation. This is a bug!',
      )
    }

    const leftmostFunction = trailingIndexesAndArgumentsToExpression(
      { 0: '@lookup', 1: { key: leftmostOperator[0] } },
      leftmostOperator[1],
    )

    const reducedLeftmostOperation: Molecule = {
      0: '@apply',
      1: {
        function: {
          0: '@apply',
          1: {
            function: leftmostFunction,
            argument: leftmostOperationRHS,
          },
        },
        argument: leftmostOperationLHS,
      },
    }

    return infixTokensToExpression([
      reducedLeftmostOperation,
      ...operation.slice(3),
    ])
  }
}

const atomRequiringDotQuotation = atomWithAdditionalQuotationRequirements(dot)

const namedProperty = map(
  sequence([atom, colon, optionalTrivia, lazy(() => expression)]),
  ([key, _colon, _trivia, value]) => [key, value] as const,
)

const propertyWithOptionalKey = optionallySurroundedByParentheses(
  oneOf([
    namedProperty,
    map(
      lazy(() => expression),
      value => [undefined, value] as const,
    ),
  ]),
)

const propertyDelimiter = oneOf([
  sequence([optionalTrivia, comma, optionalTrivia]),
  sequence([optional(triviaExceptNewlines), newline, optionalTrivia]),
])

const argument = surroundedByParentheses(lazy(() => expression))

const compactDottedKeyPathComponent = map(
  sequence([dot, atomRequiringDotQuotation]),
  ([_dot, key]) => key,
)

const dottedKeyPathComponent = map(
  sequence([optionalTrivia, dot, optionalTrivia, atomRequiringDotQuotation]),
  ([_trivia1, _dot, _trivia2, key]) => key,
)

const sugarFreeMolecule: Parser<Molecule> = map(
  sequence([
    openingBrace,
    optionalTrivia,
    sequence([
      // Allow initial property not preceded by a delimiter (e.g. `{a, b}`).
      optional(propertyWithOptionalKey),
      zeroOrMore(
        map(
          sequence([propertyDelimiter, propertyWithOptionalKey]),
          ([_delimiter, property]) => property,
        ),
      ),
    ]),
    optional(propertyDelimiter),
    optionalTrivia,
    closingBrace,
  ]),
  ([
    _openingBrace,
    _trivia1,
    [optionalInitialProperty, remainingProperties],
    _trailingDelimiter,
    _trivia2,
    _closingBrace,
  ]) => {
    const properties =
      optionalInitialProperty === undefined
        ? remainingProperties
        : [optionalInitialProperty, ...remainingProperties]
    const enumerate = makeIncrementingIndexer()
    return properties.reduce((molecule: Writable<Molecule>, [key, value]) => {
      if (key === undefined) {
        // Note that `enumerate()` increments its internal counter as a side effect.
        molecule[enumerate()] = value
      } else {
        molecule[key] = value
      }
      return molecule
    }, {})
  },
)

type TrailingIndexOrArgument =
  | {
      readonly kind: 'argument'
      readonly argument: Molecule | Atom
    }
  | {
      readonly kind: 'index'
      readonly query: KeyPath
    }

const dottedKeyPath = oneOrMore(dottedKeyPathComponent)
const compactDottedKeyPath = oneOrMore(compactDottedKeyPathComponent)

const trailingIndexesAndArguments: Parser<readonly TrailingIndexOrArgument[]> =
  zeroOrMore(
    oneOf([
      map(dottedKeyPath, query => ({ kind: 'index', query } as const)),
      map(argument, argument => ({ kind: 'argument', argument } as const)),
    ]),
  )

const compactTrailingIndexesAndArguments: Parser<
  readonly TrailingIndexOrArgument[]
> = zeroOrMore(
  oneOf([
    map(compactDottedKeyPath, query => ({ kind: 'index', query } as const)),
    map(argument, argument => ({ kind: 'argument', argument } as const)),
  ]),
)

const infixOperator = sequence([
  atomRequiringDotQuotation,
  compactTrailingIndexesAndArguments,
])

const compactExpression: Parser<Molecule | Atom> = oneOf([
  // (a)
  // (1 + 1)
  // (a => :b)(c)
  // ({ a: 1 } |> :identity).a
  map(
    sequence([
      surroundedByParentheses(lazy(() => expression)),
      compactTrailingIndexesAndArguments,
    ]),
    ([expression, trailingIndexesAndArguments]) =>
      trailingIndexesAndArgumentsToExpression(
        expression,
        trailingIndexesAndArguments,
      ),
  ),
  // :a.b
  // :a.b(1).c
  // :f(x)
  // :a.b(1)(2)
  lazy(() => precededByColonThenAtom),
  // {}
  lazy(() => precededByOpeningBrace),
  // 1
  atom,
])

const trailingInfixTokens = oneOrMore(
  map(
    oneOf([
      // Allowing newlines both before and after operators could lead to
      // ambiguity between three enumerated object properties, or a single
      // enumerated property whose value is the result of an infix expression:
      // ```
      // {
      //   1
      //   +
      //   1
      // }
      // ```
      // TODO: This could be made context-dependent, only forbidding newlines
      // when between curly braces. Currently this forbids the above formatting
      // even within parentheses, where there would be no ambiguity.
      sequence([
        trivia,
        infixOperator,
        triviaExceptNewlines,
        compactExpression,
      ]),
      sequence([
        triviaExceptNewlines,
        infixOperator,
        trivia,
        compactExpression,
      ]),
    ]),
    ([_trivia1, operator, _trivia2, operand]) => [operator, operand] as const,
  ),
)

const precededByAtomThenArrow = map(
  sequence([
    atom,
    // a => :b
    // a => {}
    // a => (b => c => :d)
    // a => b => c => d
    // a => 1 + 1
    trivia,
    arrow,
    trivia,
    zeroOrMore(
      map(
        sequence([atom, trivia, arrow, trivia]),
        ([parameter, _trivia1, _arrow, _trivia2]) => parameter,
      ),
    ),
    lazy(() => expression),
  ]),
  ([
    initialParameter,
    _trivia1,
    _arrow,
    _trivia2,
    trailingParameters,
    body,
  ]) => {
    const [lastParameter, ...additionalParameters] = [
      ...trailingParameters.toReversed(),
      initialParameter,
    ]
    const initialFunction = {
      0: '@function',
      1: {
        parameter: lastParameter,
        body: body,
      },
    }
    return additionalParameters.reduce(
      (expression, additionalParameter) => ({
        0: '@function',
        1: {
          parameter: additionalParameter,
          body: expression,
        },
      }),
      initialFunction,
    )
  },
)

// @runtime { context => … }
// @panic
// @todo blah
const precededByAtSign = map(
  sequence([
    atSign,
    unquotedAtomParser,
    optionalTrivia,
    optional(lazy(() => expression)),
  ]),
  ([_atSign, keyword, _trivia, argument]) => ({
    0: `@${keyword}`,
    1: argument === undefined ? {} : argument,
  }),
)

// :a
// :a.b
// :a.b(1).c
// :f(x)
// :a.b(1)(2)
const precededByColonThenAtom = map(
  sequence([colon, atomRequiringDotQuotation, trailingIndexesAndArguments]),
  ([_colon, key, trailingIndexesAndArguments]) =>
    trailingIndexesAndArgumentsToExpression(
      { 0: '@lookup', 1: { key } },
      trailingIndexesAndArguments,
    ),
)

// (1 + 1)
// (1 + 2 + 3 + 4)
// (x => :x)
// (x => :x)(x).b
// (1 + 1).b
// (:x => x)(1)
// (:f >> :g)(1)
const precededByOpeningParenthesis = map(
  sequence([
    surroundedByParentheses(lazy(() => expression)),
    trailingIndexesAndArguments,
  ]),
  ([expression, trailingIndexesAndArguments]) =>
    trailingIndexesAndArgumentsToExpression(
      expression,
      trailingIndexesAndArguments,
    ),
)

// {}
// { a: b }
// { 1, 2, 3 }
const precededByOpeningBrace = map(
  sequence([sugarFreeMolecule, trailingIndexesAndArguments]),
  ([expression, trailingIndexesAndArguments]) =>
    trailingIndexesAndArgumentsToExpression(
      expression,
      trailingIndexesAndArguments,
    ),
)

export const expression: Parser<Atom | Molecule> = map(
  sequence([
    oneOf([
      precededByOpeningParenthesis,
      precededByOpeningBrace,
      precededByAtSign,
      precededByColonThenAtom,
      precededByAtomThenArrow,
      atom,
    ]),
    optional(trailingInfixTokens),
  ]),
  ([initialExpression, trailingInfixTokens]) => {
    if (trailingInfixTokens === undefined) {
      return initialExpression
    } else {
      return infixTokensToExpression([
        initialExpression,
        ...trailingInfixTokens.flat(),
      ])
    }
  },
)
