import * as eitherUtilities from './adts/either-utilities.js'
import * as eitherADT from './adts/either.js'
import * as optionUtilities from './adts/option-utilities.js'
import * as optionADT from './adts/option.js'

export type { Either } from './adts/either.js'
export type { Option } from './adts/option.js'
export const either = { ...eitherADT, ...eitherUtilities }
export const option = { ...optionADT, ...optionUtilities }
