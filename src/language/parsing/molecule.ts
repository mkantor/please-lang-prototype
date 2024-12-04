import { parser, type Parser } from '../../parsing.js'
import { atomParser, type Atom } from './atom.js'
import { optionallySurroundedByParentheses } from './parentheses.js'

export type Molecule = { readonly [key: Atom]: Molecule | Atom }

export const unit: Molecule = {}

export const moleculeParser: Parser<Molecule> =
  optionallySurroundedByParentheses(
    parser.map(
      parser.lazy(() => moleculeAsEntries(makeIncrementingIndexer())),
      Object.fromEntries,
    ),
  )

// During parsing molecules and properties are represented as nested arrays (of key/value pairs).
// The following utilities make it easier to work with such a structure.

const flat = <Output>(theParser: Parser<readonly Output[]>) =>
  parser.map(theParser, output => output.flat())

const omit = (theParser: Parser<unknown>) => parser.as(theParser, [])

const optional = <Output>(
  theParser: Parser<readonly Output[]>,
): Parser<readonly Output[]> => parser.oneOf([theParser, omit(parser.nothing)])

const withoutOmittedOutputs = <Output>(
  theParser: Parser<readonly (readonly Output[])[]>,
) => parser.map(theParser, output => output.filter(output => output.length > 0))

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

const propertyDelimiter = parser.regularExpression(/[\s,]+/)
const whitespace = parser.regularExpression(/\s+/)

const sugaredLookup: Parser<PartialMolecule> =
  optionallySurroundedByParentheses(
    parser.map(
      parser.sequence([
        parser.literal(':'),
        parser.oneOf([atomParser, moleculeParser]),
      ]),
      ([_colon, query]) => ({ 0: '@lookup', 1: query }),
    ),
  )

const sugaredApply: Parser<PartialMolecule> = parser.map(
  parser.sequence([
    sugaredLookup,
    parser.literal('('),
    parser.lazy(() => propertyValue),
    parser.literal(')'),
  ]),
  ([f, _, argument]) => ({
    0: '@apply',
    1: f,
    2: argument,
  }),
)

const propertyKey = atomParser
const propertyValue = parser.oneOf([
  sugaredApply, // this must come first to avoid ambiguity
  atomParser,
  parser.lazy(() => moleculeParser),
  sugaredLookup,
])

const namedProperty = flat(
  parser.sequence([
    propertyKey,
    omit(parser.literal(':')),
    optional(omit(whitespace)),
    propertyValue,
  ]),
)

const numberedProperty = (index: Indexer) =>
  parser.map(propertyValue, value => [index(), value])

const property = (index: Indexer) =>
  optionallySurroundedByParentheses(
    parser.oneOf([namedProperty, numberedProperty(index)]),
  )

const moleculeAsEntries = (index: Indexer) =>
  withoutOmittedOutputs(
    flat(
      parser.sequence([
        omit(parser.literal('{')),
        // Allow initial property not preceded by a delimiter (e.g. `{a b}`).
        parser.map(optional(property(index)), property => [property]),
        parser.zeroOrMore(
          flat(
            parser.sequence([
              omit(propertyDelimiter),
              parser.lazy(() => property(index)),
            ]),
          ),
        ),
        optional(omit(propertyDelimiter)),
        omit(parser.literal('}')),
      ]),
    ),
  )

// This is a lazy workaround for `parser.sequence` returning an array rather than a tuple with
// definitely-present elements.
type PartialMolecule = {
  readonly [key: Atom]: PartialMolecule | Atom | undefined
}
