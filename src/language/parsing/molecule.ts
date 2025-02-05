import {
  as,
  lazy,
  literal,
  map,
  nothing,
  oneOf,
  oneOrMore,
  sequence,
  zeroOrMore,
  type Parser,
} from '@matt.kantor/parsing'
import { atomParser, type Atom } from './atom.js'
import { optionallySurroundedByParentheses } from './parentheses.js'
import { trivia } from './trivia.js'

export type Molecule = { readonly [key: Atom]: Molecule | Atom }

export const unit: Molecule = {}

export const moleculeParser: Parser<Molecule> = oneOf([
  optionallySurroundedByParentheses(
    map(
      lazy(() => moleculeAsEntries(makeIncrementingIndexer())),
      Object.fromEntries,
    ),
  ),
  lazy(() => sugaredApply),
  lazy(() => sugaredFunction),
])

// During parsing molecules and properties are represented as nested arrays (of key/value pairs).
// The following utilities make it easier to work with such a structure.

const omit = (theParser: Parser<unknown>) => as(theParser, [])

const optional = <Output>(
  theParser: Parser<readonly Output[]>,
): Parser<readonly Output[]> => oneOf([theParser, omit(nothing)])

const withoutOmittedOutputs = <Output>(
  theParser: Parser<readonly (readonly Output[])[]>,
) => map(theParser, output => output.filter(output => output.length > 0))

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

// Language-specific parsers follow.

const propertyDelimiter = oneOf([
  sequence([optional(trivia), literal(','), optional(trivia)]),
  trivia,
])

const sugaredLookup: Parser<Molecule> = optionallySurroundedByParentheses(
  map(
    sequence([literal(':'), oneOf([atomParser, moleculeParser])]),
    ([_colon, query]) => ({ 0: '@lookup', query }),
  ),
)

const sugaredFunction: Parser<Molecule> = optionallySurroundedByParentheses(
  map(
    sequence([
      atomParser,
      trivia,
      literal('=>'),
      trivia,
      lazy(() => propertyValue),
    ]),
    ([parameter, _trivia1, _arrow, _trivia2, body]) => ({
      0: '@function',
      parameter,
      body,
    }),
  ),
)

const sugaredApply: Parser<Molecule> = map(
  sequence([
    oneOf([sugaredLookup, lazy(() => sugaredFunction)]),
    oneOrMore(
      sequence([
        literal('('),
        optional(trivia),
        lazy(() => propertyValue),
        optional(trivia),
        literal(')'),
      ]),
    ),
  ]),
  ([f, multipleArguments]) =>
    multipleArguments.reduce<Molecule>(
      (expression, [_1, _2, argument, _3, _4]) => ({
        0: '@apply',
        function: expression,
        argument,
      }),
      f,
    ),
)

const propertyKey = atomParser
const propertyValue = oneOf([
  sugaredApply, // must come first to avoid ambiguity
  lazy(() => moleculeParser), // must come second to avoid ambiguity
  atomParser,
  sugaredLookup,
])

const namedProperty = map(
  sequence([propertyKey, literal(':'), optional(trivia), propertyValue]),
  ([key, _colon, _trivia, value]) => [key, value] as const,
)

const numberedProperty = (index: Indexer) =>
  map(propertyValue, value => [index(), value] as const)

const property = (index: Indexer) =>
  optionallySurroundedByParentheses(
    oneOf([namedProperty, numberedProperty(index)]),
  )

const moleculeAsEntries = (index: Indexer) =>
  withoutOmittedOutputs(
    map(
      sequence([
        literal('{'),
        // Allow initial property not preceded by a delimiter (e.g. `{a b}`).
        map(optional(property(index)), property => [property]),
        zeroOrMore(
          map(
            sequence([propertyDelimiter, property(index)]),
            ([_delimiter, property]) => property,
          ),
        ),
        optional(omit(propertyDelimiter)),
        literal('}'),
      ]),
      ([
        _openingBrace,
        optionalInitialProperty,
        remainingProperties,
        _delimiter,
        _closingBrace,
      ]) => [...optionalInitialProperty, ...remainingProperties],
    ),
  )
