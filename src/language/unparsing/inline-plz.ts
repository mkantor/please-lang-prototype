import type { Right } from '@matt.kantor/either'
import either, { type Either } from '@matt.kantor/either'
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
  type KeyPath,
  type SemanticGraph,
} from '../semantics.js'
import { type Notation } from './unparsing-utilities.js'

// TODO: Share implementation details with pretty plz notation.

const dot = kleur.dim('.')
const quote = kleur.dim('"')
const colon = kleur.dim(':')
const comma = kleur.dim(',')
const openBrace = kleur.dim('{')
const closeBrace = kleur.dim('}')
const openParenthesis = kleur.dim('(')
const closeParenthesis = kleur.dim(')')
const arrow = kleur.dim('=>')

const escapeStringContents = (value: string) =>
  value.replace('\\', '\\\\').replace('"', '\\"')

const quoteIfNecessary = (value: string) => {
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

const atom = (node: string): Right<string> =>
  either.makeRight(
    quoteIfNecessary(
      /^@[^@]/.test(node) ? kleur.bold(kleur.underline(node)) : node,
    ),
  )

const molecule = (
  value: Molecule,
): Either<UnserializableValueError, string> => {
  const functionExpressionResult = readFunctionExpression(value)
  if (!either.isLeft(functionExpressionResult)) {
    return sugaredFunction(
      functionExpressionResult.value.parameter,
      functionExpressionResult.value.body,
    )
  } else {
    const applyExpressionResult = readApplyExpression(value)
    if (!either.isLeft(applyExpressionResult)) {
      return sugaredApply(
        applyExpressionResult.value.argument,
        applyExpressionResult.value.function,
      )
    } else {
      const lookupExpressionResult = readLookupExpression(value)
      if (!either.isLeft(lookupExpressionResult)) {
        return sugaredLookup(lookupExpressionResult.value.query)
      } else {
        return sugarFreeMolecule(value)
      }
    }
  }
}

const sugaredLookup = (keyPathAsNode: Molecule | SemanticGraph) => {
  const keyPath = Object.entries(keyPathAsNode).reduce(
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
    Object.keys(keyPathAsNode).length === keyPath.length &&
    keyPath.every(key => !either.isLeft(unquotedAtomParser(key)))
  ) {
    return either.makeRight(kleur.cyan(colon.concat(keyPath.join(dot))))
  } else {
    return either.flatMap(serializeIfNeeded(keyPathAsNode), serializedKeyPath =>
      either.map(atomOrMolecule(serializedKeyPath), keyPathAsString =>
        kleur.cyan(colon.concat(keyPathAsString)),
      ),
    )
  }
}

const sugaredFunction = (
  parameterName: string,
  body: Molecule | SemanticGraph,
) =>
  either.flatMap(serializeIfNeeded(body), serializedBody =>
    either.map(atomOrMolecule(serializedBody), bodyAsString =>
      [kleur.cyan(parameterName), arrow, bodyAsString].join(' '),
    ),
  )

const sugaredApply = (
  argument: Molecule | SemanticGraph,
  functionToApply: Molecule | SemanticGraph,
) =>
  either.flatMap(serializeIfNeeded(functionToApply), serializedFunction =>
    either.flatMap(
      atomOrMolecule(serializedFunction),
      functionToApplyAsString =>
        either.flatMap(serializeIfNeeded(argument), serializedArgument =>
          either.map(atomOrMolecule(serializedArgument), argumentAsString =>
            functionToApplyAsString
              .concat(openParenthesis)
              .concat(argumentAsString)
              .concat(closeParenthesis),
          ),
        ),
    ),
  )

const sugarFreeMolecule = (value: Molecule) => {
  const entries = Object.entries(value)
  if (entries.length === 0) {
    return either.makeRight(openBrace + closeBrace)
  } else {
    const keyValuePairsAsStrings: string[] = []
    let ordinalPropertyKeyCounter = 0n
    for (const [propertyKey, propertyValue] of entries) {
      const valueAsStringResult = atomOrMolecule(propertyValue)
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

    return either.makeRight(
      openBrace
        .concat(' ')
        .concat(keyValuePairsAsStrings.join(comma.concat(' ')))
        .concat(' ')
        .concat(closeBrace),
    )
  }
}

const serializeIfNeeded = (
  nodeOrMolecule: SemanticGraph | Molecule,
): Either<UnserializableValueError, Atom | Molecule> =>
  isSemanticGraph(nodeOrMolecule)
    ? serialize(nodeOrMolecule)
    : either.makeRight(nodeOrMolecule)

const atomOrMolecule = (value: Atom | Molecule) =>
  typeof value === 'string' ? atom(value) : molecule(value)

export const inlinePlz: Notation = { atom, molecule }
