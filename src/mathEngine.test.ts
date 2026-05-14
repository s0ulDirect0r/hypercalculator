import { describe, expect, it } from 'vitest'
import {
  appendToken,
  evaluateNumeric,
  formatExpressionInput,
  makeAnalysis,
  normalizeExpressionForMath,
  parseComplex,
  parseSimpleDivision,
  parseVector,
  tryEvaluate,
} from './mathEngine'

const expectNumber = (value: unknown, expected: number) => {
  expect(Number(value)).toBeCloseTo(expected, 10)
}

describe('math engine expression handling', () => {
  it('normalizes display glyphs, implicit multiplication, exponents, and fractions', () => {
    expect(normalizeExpressionForMath('2x + 3(x + 1)')).toBe('2*x+3*(x+1)')
    expect(normalizeExpressionForMath('π÷2')).toBe('pi/2')
    expect(normalizeExpressionForMath('x² - ⅒x')).toBe('x^2-(1/10)*x')
  })

  it('formats common typed math without changing the evaluated expression semantics', () => {
    expect(formatExpressionInput('x^2 - 1/10')).toBe('x² - ⅒')
    expect(formatExpressionInput('x^2 - 1/10x')).toBe('x² - 1/10x')
    expectNumber(tryEvaluate(formatExpressionInput('1/10x^2 - 4'), 'rad', { x: 10 }), 6)
  })

  it('respects standard order of operations during evaluation', () => {
    expectNumber(tryEvaluate('2 + 3 * 4', 'rad'), 14)
    expectNumber(tryEvaluate('(2 + 3) * 4', 'rad'), 20)
    expectNumber(tryEvaluate('10 - 6 / 3 + 2^3', 'rad'), 16)
  })

  it('evaluates calculator functions and angle modes', () => {
    expectNumber(tryEvaluate('sin(pi / 2)', 'rad'), 1)
    expectNumber(tryEvaluate('sin(30)', 'deg'), 0.5)
    expectNumber(tryEvaluate('nthRoot(-8, 3)', 'rad'), -2)
    expectNumber(tryEvaluate('log10(1000) + log2(8)', 'rad'), 6)
  })

  it('keeps keypad token appends predictable after edits', () => {
    expect(appendToken('0', '7')).toBe('7')
    expect(appendToken('7+', '*')).toBe('7*')
    expect(appendToken('7+', '.')).toBe('7+0.')
    expect(appendToken('7.2', '.')).toBe('7.2')
    expect(appendToken('x', '^2')).toBe('x^2')
  })
})

describe('math object analysis', () => {
  it('solves roots and evaluates derivative transforms for functions', () => {
    const analysis = makeAnalysis('x^2 - 4', 'rad', 'fx', 'function')
    expect(analysis.kind).toBe('function2d')
    expect(analysis.rootAnalysis.kind).toBe('roots')
    expect(analysis.rootAnalysis.roots).toHaveLength(2)
    expect(analysis.rootAnalysis.roots[0]).toBeCloseTo(-2, 2)
    expect(analysis.rootAnalysis.roots[1]).toBeCloseTo(2, 2)

    const derivative = makeAnalysis('x^2 - 4', 'rad', 'fx', 'derivative')
    expect(derivative.activeExpression).not.toBe('x^2 - 4')
    expect(evaluateNumeric(derivative.activeExpression, 'rad', { x: 3 })).toBeCloseTo(6, 8)
  })

  it('recognizes ratio, vector, complex, 2D geometry, and 3D primitives', () => {
    expect(parseSimpleDivision('67/40')?.value).toBeCloseTo(1.675, 10)

    const vector = parseVector('<3, 4>', 'rad')
    expect(vector?.magnitude).toBeCloseTo(5, 10)

    const complex = parseComplex('3 + 4i')
    expect(complex?.magnitude).toBeCloseTo(5, 10)
    expect(complex?.conjugate).toBe('3 - 4i')

    const circle = makeAnalysis('circle(center=(2,3), r=4)', 'rad', 'auto', 'function')
    expect(circle.kind).toBe('geometry2d')
    expect(circle.geometry?.kind).toBe('circle')

    const sphere = makeAnalysis('sphere(center=(0,0,0), r=3)', 'rad', 'auto', 'function')
    expect(sphere.kind).toBe('primitive3d')
    expect(sphere.primitive3d?.kind).toBe('sphere')
  })
})
