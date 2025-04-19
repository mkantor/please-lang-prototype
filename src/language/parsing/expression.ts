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
  type Atom,
} from './atom.js'
import {
  arrow,
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
          function: expression,
          argument: indexOrArgument.argument,
        }
      case 'index':
        return {
          0: '@index',
          object: expression,
          query: keyPathToMolecule(indexOrArgument.query),
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
      { 0: '@lookup', key: leftmostOperator[0] },
      leftmostOperator[1],
    )

    const reducedLeftmostOperation: Molecule = {
      0: '@apply',
      function: {
        0: '@apply',
        function: leftmostFunction,
        argument: leftmostOperationRHS,
      },
      argument: leftmostOperationLHS,
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
  // (a => :b).c(d)
  // (1 + 1)
  map(
    sequence([
      surroundedByParentheses(
        oneOf([
          lazy(() => precededByAtomThenTrivia),
          lazy(() => precededByColonThenAtom),
        ]),
      ),
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
  map(
    sequence([
      colon,
      atomRequiringDotQuotation,
      compactTrailingIndexesAndArguments,
    ]),
    ([_colon, key, trailingIndexesAndArguments]) =>
      trailingIndexesAndArgumentsToExpression(
        { 0: '@lookup', key },
        trailingIndexesAndArguments,
      ),
  ),
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

type TrailingInfixToken = readonly [
  operator: readonly [Atom, readonly TrailingIndexOrArgument[]],
  operand: Molecule | Atom,
]
type TrailingFunctionBodyOrInfixTokens =
  | {
      readonly kind: 'functionBody'
      readonly additionalParameters: readonly Atom[]
      readonly body: Molecule | Atom
    }
  | {
      readonly kind: 'infixTokens'
      readonly tokens: readonly [
        TrailingInfixToken,
        ...(readonly TrailingInfixToken[]),
      ]
    }

const precededByAtomThenTrivia = map(
  sequence([
    atom,
    oneOf([
      // a => :b
      // a => {}
      // a => (b => c => :d)
      // a => b => c => d
      // a => 1 + 1
      map(
        sequence([
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
          _trivia1,
          _arrow,
          _trivia2,
          additionalParameters,
          body,
        ]): TrailingFunctionBodyOrInfixTokens => ({
          kind: 'functionBody',
          additionalParameters,
          body,
        }),
      ),
      // 1 + 2 + 3 + 4
      // 1 + (2 + 3 + 4)
      map(
        trailingInfixTokens,
        (tokens): TrailingFunctionBodyOrInfixTokens => ({
          kind: 'infixTokens',
          tokens,
        }),
      ),
    ]),
  ]),
  ([initialAtom, trailingFunctionBodyOrInfixTokens]) => {
    switch (trailingFunctionBodyOrInfixTokens.kind) {
      case 'functionBody':
        const [lastParameter, ...additionalParameters] = [
          ...trailingFunctionBodyOrInfixTokens.additionalParameters.toReversed(),
          initialAtom,
        ]
        const initialFunction = {
          0: '@function',
          parameter: lastParameter,
          body: trailingFunctionBodyOrInfixTokens.body,
        }
        return additionalParameters.reduce(
          (expression, additionalParameter) => ({
            0: '@function',
            parameter: additionalParameter,
            body: expression,
          }),
          initialFunction,
        )
      case 'infixTokens':
        return infixTokensToExpression([
          initialAtom,
          ...trailingFunctionBodyOrInfixTokens.tokens.flat(),
        ])
    }
  },
)

// :a
// :a.b
// :a.b(1).c
// :f(x)
// :a.b(1)(2)
// :a b.c :z
// :a b.c z
// :f(g) + b
// :a + :b + :c + :d
const precededByColonThenAtom = map(
  sequence([
    colon,
    atomRequiringDotQuotation,
    trailingIndexesAndArguments,
    zeroOrMore(
      map(
        // See note in `trailingInfixTokens` about newlines.
        oneOf([
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
        ([_trivia1, operator, _trivia2, operand]) =>
          [operator, operand] as const,
      ),
    ),
  ]),
  ([_colon, key, trailingIndexesAndArguments, infixOperationTokens]) => {
    const initialExpression = trailingIndexesAndArgumentsToExpression(
      { 0: '@lookup', key },
      trailingIndexesAndArguments,
    )
    const [firstToken, ...additionalTokens] = infixOperationTokens
    if (firstToken === undefined) {
      return initialExpression
    } else {
      return infixTokensToExpression([
        initialExpression,
        ...firstToken,
        ...additionalTokens.flat(),
      ])
    }
  },
)

// (1 + 1)
// (1 + 2 + 3 + 4)
// (x => :x)
// (x => :x)(x).b
// (1 + 1).b
// (:x => x)(1)
// (:f >> :g)(1)
// (1 + 1) - (1 + 1)
const precededByOpeningParenthesis = oneOf([
  map(
    sequence([
      surroundedByParentheses(lazy(() => expression)),
      trailingInfixTokens,
    ]),
    ([initialExpression, trailingInfixTokens]) =>
      infixTokensToExpression([
        initialExpression,
        ...trailingInfixTokens.flat(),
      ]),
  ),
  map(
    sequence([
      surroundedByParentheses(lazy(() => expression)),
      trailingIndexesAndArguments,
    ]),
    ([expression, trailingIndexesAndArguments]) =>
      trailingIndexesAndArgumentsToExpression(
        expression,
        trailingIndexesAndArguments,
      ),
  ),
])

// {}
// { a: b }
// { 1, 2, 3 }
// {a::f}.a(1) + 1
const precededByOpeningBrace = map(
  sequence([sugarFreeMolecule, trailingIndexesAndArguments]),
  ([expression, trailingIndexesAndArguments]) =>
    trailingIndexesAndArgumentsToExpression(
      expression,
      trailingIndexesAndArguments,
    ),
)

export const expression: Parser<Atom | Molecule> = oneOf([
  precededByOpeningParenthesis,
  precededByOpeningBrace,
  precededByColonThenAtom,
  precededByAtomThenTrivia,
  atom,
])
