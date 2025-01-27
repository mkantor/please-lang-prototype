import either, { type Either, type Right } from '@matt.kantor/either'
import kleur from 'kleur'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { unquotedAtomParser } from '../parsing/atom.js'
import {
  isSemanticGraph,
  readApplyExpression,
  readFunctionExpression,
  readLookupExpression,
  serialize,
  type ApplyExpression,
  type FunctionExpression,
  type KeyPath,
  type LookupExpression,
  type SemanticGraph,
} from '../semantics.js'

export const dot = kleur.dim('.')
export const quote = kleur.dim('"')
export const colon = kleur.dim(':')
export const comma = kleur.dim(',')
export const openBrace = kleur.dim('{')
export const closeBrace = kleur.dim('}')
export const openParenthesis = kleur.dim('(')
export const closeParenthesis = kleur.dim(')')
export const arrow = kleur.dim('=>')

export const moleculeUnparser =
  (
    unparseAtomOrMolecule: UnparseAtomOrMolecule,
    unparseSugarFreeMolecule: (
      expression: Molecule,
      unparseAtomOrMolecule: UnparseAtomOrMolecule,
    ) => Either<UnserializableValueError, string>,
  ) =>
  (value: Molecule): Either<UnserializableValueError, string> => {
    const functionExpressionResult = readFunctionExpression(value)
    if (!either.isLeft(functionExpressionResult)) {
      return unparseSugaredFunction(
        functionExpressionResult.value,
        unparseAtomOrMolecule,
      )
    } else {
      const applyExpressionResult = readApplyExpression(value)
      if (!either.isLeft(applyExpressionResult)) {
        return unparseSugaredApply(
          applyExpressionResult.value,
          unparseAtomOrMolecule,
        )
      } else {
        const lookupExpressionResult = readLookupExpression(value)
        if (!either.isLeft(lookupExpressionResult)) {
          return unparseSugaredLookup(
            lookupExpressionResult.value,
            unparseAtomOrMolecule,
          )
        } else {
          return unparseSugarFreeMolecule(value, unparseAtomOrMolecule)
        }
      }
    }
  }

export const quoteIfNecessary = (value: string): string => {
  const unquotedAtomResult = unquotedAtomParser(value)
  if (
    either.isLeft(unquotedAtomResult) ||
    unquotedAtomResult.value.remainingInput.length !== 0
  ) {
    return quote.concat(escapeStringContents(value)).concat(quote)
  } else {
    return value
  }
}

export const serializeIfNeeded = (
  nodeOrMolecule: SemanticGraph | Molecule,
): Either<UnserializableValueError, Atom | Molecule> =>
  isSemanticGraph(nodeOrMolecule)
    ? serialize(nodeOrMolecule)
    : either.makeRight(nodeOrMolecule)

export const sugarFreeMoleculeAsKeyValuePairStrings = (
  value: Molecule,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
): Either<UnserializableValueError, readonly string[]> => {
  const entries = Object.entries(value)

  const keyValuePairsAsStrings: string[] = []
  let ordinalPropertyKeyCounter = 0n
  for (const [propertyKey, propertyValue] of entries) {
    const valueAsStringResult = unparseAtomOrMolecule(propertyValue)
    if (either.isLeft(valueAsStringResult)) {
      return valueAsStringResult
    }

    // Omit ordinal property keys:
    if (propertyKey === String(ordinalPropertyKeyCounter)) {
      keyValuePairsAsStrings.push(valueAsStringResult.value)
      ordinalPropertyKeyCounter += 1n
    } else {
      keyValuePairsAsStrings.push(
        kleur
          .cyan(quoteIfNecessary(propertyKey).concat(colon))
          .concat(' ')
          .concat(valueAsStringResult.value),
      )
    }
  }
  return either.makeRight(keyValuePairsAsStrings)
}

export const unparseAtom = (atom: string): Right<string> =>
  either.makeRight(
    quoteIfNecessary(
      /^@[^@]/.test(atom) ? kleur.bold(kleur.underline(atom)) : atom,
    ),
  )

type UnparseAtomOrMolecule = (
  value: Atom | Molecule,
) => Either<UnserializableValueError, string>

const escapeStringContents = (value: string) =>
  value.replace('\\', '\\\\').replace('"', '\\"')

const unparseSugaredApply = (
  expression: ApplyExpression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
) =>
  either.flatMap(serializeIfNeeded(expression.function), serializedFunction =>
    either.flatMap(
      unparseAtomOrMolecule(serializedFunction),
      functionToApplyAsString =>
        either.flatMap(
          serializeIfNeeded(expression.argument),
          serializedArgument =>
            either.map(
              unparseAtomOrMolecule(serializedArgument),
              argumentAsString =>
                functionToApplyAsString
                  .concat(openParenthesis)
                  .concat(argumentAsString)
                  .concat(closeParenthesis),
            ),
        ),
    ),
  )

const unparseSugaredFunction = (
  expression: FunctionExpression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
) =>
  either.flatMap(serializeIfNeeded(expression.body), serializedBody =>
    either.map(unparseAtomOrMolecule(serializedBody), bodyAsString =>
      [kleur.cyan(expression.parameter), arrow, bodyAsString].join(' '),
    ),
  )

const unparseSugaredLookup = (
  expression: LookupExpression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
) => {
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
    keyPath !== 'invalid' &&
    Object.keys(expression.query).length === keyPath.length &&
    keyPath.every(key => !either.isLeft(unquotedAtomParser(key)))
  ) {
    return either.makeRight(kleur.cyan(colon.concat(keyPath.join(dot))))
  } else {
    return either.flatMap(
      serializeIfNeeded(expression.query),
      serializedKeyPath =>
        either.map(unparseAtomOrMolecule(serializedKeyPath), keyPathAsString =>
          kleur.cyan(colon.concat(keyPathAsString)),
        ),
    )
  }
}
