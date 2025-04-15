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
import { keyPathToMolecule } from '../semantics.js'
import {
  atomParser,
  atomWithAdditionalQuotationRequirements,
  type Atom,
} from './atom.js'
import {
  arrow,
  closingBrace,
  closingParenthesis,
  colon,
  comma,
  dot,
  newline,
  openingBrace,
  openingParenthesis,
} from './literals.js'
import { optionallySurroundedByParentheses } from './parentheses.js'
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

const propertyKey = atomParser
const propertyValue = oneOf([
  lazy(() => potentiallySugaredMolecule),
  atomParser,
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

const argument = map(
  sequence([
    openingParenthesis,
    optionalTrivia,
    propertyValue,
    optionalTrivia,
    closingParenthesis,
  ]),
  ([_openingParenthesis, _trivia1, argument, _trivia2, _closingParenthesis]) =>
    argument,
)

const dottedKeyPathComponent = map(
  sequence([
    optionalTrivia,
    dot,
    optionalTrivia,
    atomWithAdditionalQuotationRequirements(dot),
  ]),
  ([_trivia1, _dot, _trivia2, key]) => key,
)

const sugarFreeMolecule: Parser<Molecule> = optionallySurroundedByParentheses(
  map(
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
  ),
)

const sugaredLookup: Parser<Molecule> = optionallySurroundedByParentheses(
  map(
    sequence([
      colon,
      // Reserve `.` so that `:a.b` is parsed as a lookup followed by an index.
      atomWithAdditionalQuotationRequirements(dot),
    ]),
    ([_colon, key]) => ({ 0: '@lookup', key }),
  ),
)

const sugaredFunction: Parser<Molecule> = optionallySurroundedByParentheses(
  map(
    sequence([atomParser, trivia, arrow, trivia, propertyValue]),
    ([parameter, _trivia1, _arrow, _trivia2, body]) => ({
      0: '@function',
      parameter,
      body,
    }),
  ),
)

const potentiallySugaredMolecule: Parser<Molecule> = (() => {
  // The awkward setup in here avoids infinite recursion when applying the mutually-dependent
  // parsers for index and apply sugars. Indexes/applications can be chained to form
  // arbitrarily-long expressions (e.g. `:a.b.c(d).e(f)(g).h.i(j).k`).

  const potentiallySugaredNonApply = map(
    sequence([
      oneOf([sugaredLookup, sugaredFunction, sugarFreeMolecule]),
      zeroOrMore(dottedKeyPathComponent),
    ]),
    ([object, keyPath]) =>
      keyPath.length === 0
        ? object
        : {
            0: '@index',
            object,
            query: keyPathToMolecule(keyPath),
          },
  )

  const sugaredApplyWithOptionalTrailingIndexesAndApplies = map(
    sequence([
      potentiallySugaredNonApply,
      oneOrMore(argument),
      zeroOrMore(
        sequence([oneOrMore(dottedKeyPathComponent), zeroOrMore(argument)]),
      ),
    ]),
    ([
      functionToApply,
      multipleArguments,
      trailingIndexQueriesAndApplyArguments,
    ]) => {
      const initialApply = multipleArguments.reduce<Molecule>(
        (expression, argument) => ({
          0: '@apply',
          function: expression,
          argument,
        }),
        functionToApply,
      )

      return trailingIndexQueriesAndApplyArguments.reduce(
        (expression, [keyPath, possibleArguments]) =>
          possibleArguments.reduce<Molecule>(
            (functionToApply, argument) => ({
              0: '@apply',
              function: functionToApply,
              argument,
            }),
            {
              0: '@index',
              object: expression,
              query: keyPathToMolecule(keyPath),
            },
          ),
        initialApply,
      )
    },
  )

  return oneOf([
    sugaredApplyWithOptionalTrailingIndexesAndApplies,
    potentiallySugaredNonApply,
  ])
})()

export const moleculeParser: Parser<Molecule> = potentiallySugaredMolecule
