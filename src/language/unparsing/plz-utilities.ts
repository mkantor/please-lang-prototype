import either, { type Either, type Right } from '@matt.kantor/either'
import parsing from '@matt.kantor/parsing'
import kleur from 'kleur'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { unquotedAtomParser } from '../parsing/atom.js'
import {
  isSemanticGraph,
  readApplyExpression,
  readFunctionExpression,
  readIndexExpression,
  readLookupExpression,
  serialize,
  type ApplyExpression,
  type FunctionExpression,
  type IndexExpression,
  type KeyPath,
  type LookupExpression,
  type SemanticGraph,
} from '../semantics.js'
import { punctuation } from './unparsing-utilities.js'

export const moleculeUnparser =
  (
    unparseAtomOrMolecule: UnparseAtomOrMolecule,
    unparseSugarFreeMolecule: (
      expression: Molecule,
      unparseAtomOrMolecule: UnparseAtomOrMolecule,
    ) => Either<UnserializableValueError, string>,
  ) =>
  (value: Molecule): Either<UnserializableValueError, string> => {
    switch (value['0']) {
      case '@apply':
        return either.match(readApplyExpression(value), {
          left: _ => unparseSugarFreeMolecule(value, unparseAtomOrMolecule),
          right: applyExpression =>
            unparseSugaredApply(applyExpression, unparseAtomOrMolecule),
        })
      case '@function':
        return either.match(readFunctionExpression(value), {
          left: _ => unparseSugarFreeMolecule(value, unparseAtomOrMolecule),
          right: functionExpression =>
            unparseSugaredFunction(functionExpression, unparseAtomOrMolecule),
        })
      case '@index':
        return either.match(readIndexExpression(value), {
          left: _ => unparseSugarFreeMolecule(value, unparseAtomOrMolecule),
          right: indexExpression =>
            unparseSugaredIndex(indexExpression, unparseAtomOrMolecule),
        })
      case '@lookup':
        return either.match(readLookupExpression(value), {
          left: _ => unparseSugarFreeMolecule(value, unparseAtomOrMolecule),
          right: lookupExpression =>
            unparseSugaredLookup(lookupExpression, unparseAtomOrMolecule),
        })
      default:
        return unparseSugarFreeMolecule(value, unparseAtomOrMolecule)
    }
  }

export const moleculeAsKeyValuePairStrings = (
  value: Molecule,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
  options: { readonly ordinalKeys: 'omit' | 'preserve' },
): Either<UnserializableValueError, readonly string[]> => {
  const { colon } = punctuation(kleur)
  const entries = Object.entries(value)

  const keyValuePairsAsStrings: string[] = []
  let ordinalPropertyKeyCounter = 0n
  for (const [propertyKey, propertyValue] of entries) {
    const valueAsStringResult = unparseAtomOrMolecule(propertyValue)
    if (either.isLeft(valueAsStringResult)) {
      return valueAsStringResult
    }

    // Omit ordinal property keys:
    if (
      propertyKey === String(ordinalPropertyKeyCounter) &&
      options.ordinalKeys === 'omit'
    ) {
      keyValuePairsAsStrings.push(valueAsStringResult.value)
      ordinalPropertyKeyCounter += 1n
    } else {
      keyValuePairsAsStrings.push(
        kleur
          .cyan(quoteAtomIfNecessary(propertyKey).concat(colon))
          .concat(' ')
          .concat(valueAsStringResult.value),
      )
    }
  }
  return either.makeRight(keyValuePairsAsStrings)
}

export const unparseAtom = (atom: string): Right<string> =>
  either.makeRight(
    /^@[^@]/.test(atom)
      ? kleur.bold(kleur.underline(quoteAtomIfNecessary(atom)))
      : quoteAtomIfNecessary(atom),
  )

const quoteAtomIfNecessary = (value: string): string => {
  const { quote } = punctuation(kleur)
  const unquotedAtomResult = parsing.parse(unquotedAtomParser, value)
  if (either.isLeft(unquotedAtomResult)) {
    return quote.concat(escapeStringContents(value)).concat(quote)
  } else {
    return value
  }
}

const quoteKeyPathComponentIfNecessary = (value: string): string => {
  const { quote } = punctuation(kleur)
  const unquotedAtomResult = parsing.parse(unquotedAtomParser, value)
  if (either.isLeft(unquotedAtomResult) || value.includes('.')) {
    return quote.concat(escapeStringContents(value)).concat(quote)
  } else {
    return value
  }
}

const serializeIfNeeded = (
  nodeOrMolecule: SemanticGraph | Molecule,
): Either<UnserializableValueError, Atom | Molecule> =>
  isSemanticGraph(nodeOrMolecule)
    ? serialize(nodeOrMolecule)
    : either.makeRight(nodeOrMolecule)

type UnparseAtomOrMolecule = (
  value: Atom | Molecule,
) => Either<UnserializableValueError, string>

const escapeStringContents = (value: string) =>
  value.replace('\\', '\\\\').replace('"', '\\"')

const unparseSugaredApply = (
  expression: ApplyExpression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
) => {
  const { closeParenthesis, openParenthesis } = punctuation(kleur)
  const functionUnparseResult = either.map(
    either.flatMap(
      serializeIfNeeded(expression.function),
      unparseAtomOrMolecule,
    ),
    unparsedFunction =>
      either.isRight(readFunctionExpression(expression.function))
        ? // Immediately-applied function expressions need parentheses.
          openParenthesis.concat(unparsedFunction).concat(closeParenthesis)
        : unparsedFunction,
  )
  if (either.isLeft(functionUnparseResult)) {
    return functionUnparseResult
  }

  const argumentUnparseResult = either.flatMap(
    serializeIfNeeded(expression.argument),
    unparseAtomOrMolecule,
  )
  if (either.isLeft(argumentUnparseResult)) {
    return argumentUnparseResult
  }

  return either.makeRight(
    functionUnparseResult.value
      .concat(openParenthesis)
      .concat(argumentUnparseResult.value)
      .concat(closeParenthesis),
  )
}

const unparseSugaredFunction = (
  expression: FunctionExpression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
) =>
  either.flatMap(serializeIfNeeded(expression.body), serializedBody =>
    either.map(unparseAtomOrMolecule(serializedBody), bodyAsString =>
      [
        kleur.cyan(expression.parameter),
        punctuation(kleur).arrow,
        bodyAsString,
      ].join(' '),
    ),
  )

const unparseSugaredIndex = (
  expression: IndexExpression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
) => {
  const objectUnparseResult = either.flatMap(
    serializeIfNeeded(expression.object),
    unparseAtomOrMolecule,
  )
  if (either.isLeft(objectUnparseResult)) {
    return objectUnparseResult
  }

  const keyPath = Object.entries(expression.query).reduce(
    (accumulator: KeyPath | 'invalid', [key, value]) => {
      if (accumulator === 'invalid') {
        return accumulator
      } else {
        if (key === String(accumulator.length) && typeof value === 'string') {
          return [...accumulator, value]
        } else {
          return 'invalid'
        }
      }
    },
    [],
  )

  if (
    keyPath === 'invalid' ||
    Object.keys(expression.query).length !== keyPath.length
  ) {
    return either.makeLeft({
      kind: 'unserializableValue',
      message: 'invalid key path',
    })
  }

  const { dot } = punctuation(kleur)

  return either.makeRight(
    objectUnparseResult.value
      .concat(dot)
      .concat(keyPath.map(quoteKeyPathComponentIfNecessary).join(dot)),
  )
}

const unparseSugaredLookup = (
  expression: LookupExpression,
  _unparseAtomOrMolecule: UnparseAtomOrMolecule,
) =>
  either.makeRight(
    kleur.cyan(
      punctuation(kleur).colon.concat(
        quoteKeyPathComponentIfNecessary(expression.key),
      ),
    ),
  )
