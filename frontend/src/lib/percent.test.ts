import { describe, expect, it } from 'vitest'
import { decimalStringToPercent, percentToDecimalString } from './percent'

describe('percent conversion', () => {
  it.each([
    ['5', '0.05'],
    ['0', '0'],
    ['15', '0.15'],
    ['12.5', '0.125'],
    ['0.25', '0.0025'],
    ['99.99', '0.9999'],
    ['05', '0.05'],
  ])('%s%% -> %s', (input, out) => {
    expect(percentToDecimalString(input)).toBe(out)
  })

  it.each([
    ['0.0500', '5'],
    ['0', '0'],
    ['0.125', '12.5'],
    ['0.9999', '99.99'],
  ])('%s -> %s%%', (input, out) => {
    expect(decimalStringToPercent(input)).toBe(out)
  })
})
