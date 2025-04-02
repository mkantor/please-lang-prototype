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
  atomParser,
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
  root: Molecule,
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

const infixOperationToExpression = (
  initialExpression: Atom | Molecule,
  tokens: readonly [InfixToken, ...InfixToken[]],
): Molecule => {
  const [
    [
      [firstOperatorLookupKey, firstOperatorTrailingIndexesAndArguments],
      firstArgument,
    ],
    ...additionalTokens
  ] = tokens

  const firstFunction = trailingIndexesAndArgumentsToExpression(
    { 0: '@lookup', key: firstOperatorLookupKey },
    firstOperatorTrailingIndexesAndArguments,
  )

  const initialApplication: Molecule = {
    0: '@apply',
    function: {
      0: '@apply',
      function: firstFunction,
      argument: firstArgument,
    },
    argument: initialExpression,
  }

  return additionalTokens.reduce(
    (
      expression,
      [[operatorLookupKey, operatorTrailingIndexesAndArguments], nextArgument],
    ) => {
      const nextFunction = trailingIndexesAndArgumentsToExpression(
        { 0: '@lookup', key: operatorLookupKey },
        operatorTrailingIndexesAndArguments,
      )
      return {
        0: '@apply',
        function: {
          0: '@apply',
          function: nextFunction,
          argument: nextArgument,
        },
        argument: expression,
      }
    },
    initialApplication,
  )
}

const atomRequiringDotQuotation = atomWithAdditionalQuotationRequirements(dot)

const propertyKey: Parser<Atom> = atomParser
const propertyValue: Parser<Molecule | Atom> = oneOf([
  lazy(() => moleculeParser),
  optionallySurroundedByParentheses(atomParser),
])

const namedProperty = map(
  sequence([propertyKey, colon, optionalTrivia, propertyValue]),
  ([key, _colon, _trivia, value]) => [key, value] as const,
)

const propertyWithOptionalKey = optionallySurroundedByParentheses(
  oneOf([
    namedProperty,
    map(propertyValue, value => [undefined, value] as const),
  ]),
)

const propertyDelimiter = oneOf([
  sequence([optionalTrivia, comma, optionalTrivia]),
  sequence([optional(triviaExceptNewlines), newline, optionalTrivia]),
])

const argument = surroundedByParentheses(propertyValue)

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
  atomParser,
])

const trailingInfixTokens: Parser<
  readonly [InfixToken, ...(readonly InfixToken[])]
> = oneOrMore(
  map(
    sequence([
      trivia,
      infixOperator,
      // Allowing newlines here could lead to ambiguity. The following object could either
      // have three enumerated atom-valued properties, or a single enumerated property
      // whose value is the result of an infix expression:
      // ```
      // {
      //   1
      //   +
      //   1
      // }
      // ```
      // TODO: This could be made context-dependent, only forbidding newlines when between
      // curly braces. Currently this forbids the above formatting even within parentheses.
      triviaExceptNewlines,
      compactExpression,
    ]),
    ([_trivia1, operator, _trivia2, operand]) => [operator, operand] as const,
  ),
)

type InfixToken = readonly [
  readonly [Atom, readonly TrailingIndexOrArgument[]],
  Molecule | Atom,
]
type TrailingFunctionBodyOrInfixTokens =
  | {
      readonly kind: 'functionBody'
      readonly additionalParameters: readonly Atom[]
      readonly body: Molecule | Atom
    }
  | {
      readonly kind: 'infixTokens'
      readonly tokens: readonly [InfixToken, ...(readonly InfixToken[])]
    }
const precededByAtomThenTrivia = map(
  sequence([
    atomParser,
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
              sequence([atomParser, trivia, arrow, trivia]),
              ([parameter, _trivia1, _arrow, _trivia2]) => parameter,
            ),
          ),
          propertyValue,
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
        return infixOperationToExpression(
          initialAtom,
          trailingFunctionBodyOrInfixTokens.tokens,
        )
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
        sequence([
          trivia,
          infixOperator,
          triviaExceptNewlines, // See note in `precededByAtomThenTrivia`.
          compactExpression,
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
      return infixOperationToExpression(initialExpression, [
        firstToken,
        ...additionalTokens,
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
      surroundedByParentheses(lazy(() => moleculeParser)),
      trailingInfixTokens,
    ]),
    ([initialExpression, trailingInfixTokens]) =>
      infixOperationToExpression(initialExpression, trailingInfixTokens),
  ),
  map(
    sequence([
      surroundedByParentheses(lazy(() => moleculeParser)),
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

export const moleculeParser: Parser<Molecule> = oneOf([
  precededByOpeningParenthesis,
  precededByOpeningBrace,
  precededByColonThenAtom,
  precededByAtomThenTrivia,
])
