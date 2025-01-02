import * as eitherUtilities from './adts/either-utilities.js'
import * as eitherAdt from './adts/either.js'
import * as optionUtilities from './adts/option-utilities.js'
import * as optionAdt from './adts/option.js'

export type { Either } from './adts/either.js'
export type { Option } from './adts/option.js'
export const either = { ...eitherAdt, ...eitherUtilities }
export const option = { ...optionAdt, ...optionUtilities }
