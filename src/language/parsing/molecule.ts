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

const numberedProperty = (index: Indexer) =>
  map(propertyValue, value => [index(), value] as const)

const property = (index: Indexer) =>
  optionallySurroundedByParentheses(
    oneOf([namedProperty, numberedProperty(index)]),
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

const moleculeAsEntries = (
  index: Indexer,
): Parser<readonly (readonly [string, string | Molecule])[]> =>
  map(
    sequence([
      openingBrace,
      optional(trivia),
      // Allow initial property not preceded by a delimiter (e.g. `{a b}`).
      optional(property(index)),
      zeroOrMore(
        map(
          sequence([propertyDelimiter, property(index)]),
          ([_delimiter, property]) => property,
        ),
      ),
      optional(propertyDelimiter),
      optional(trivia),
      closingBrace,
    ]),
    ([
      _openingBrace,
      _optionalLeadingTrivia,
      optionalInitialProperty,
      remainingProperties,
      _optionalDelimiter,
      _optionalTrailingTrivia,
      _closingBrace,
    ]) =>
      optionalInitialProperty === undefined
        ? remainingProperties
        : [optionalInitialProperty, ...remainingProperties],
  )

const sugarFreeMolecule: Parser<Molecule> = optionallySurroundedByParentheses(
  map(
    lazy(() => moleculeAsEntries(makeIncrementingIndexer())),
    Object.fromEntries,
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
