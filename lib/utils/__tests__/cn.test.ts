import { describe, it, expect } from 'vitest'
import { cn } from '../cn'

describe('cn', () => {
  it('merges class names correctly', () => {
    const result = cn('class1', 'class2', 'class3')
    expect(result).toContain('class1')
    expect(result).toContain('class2')
    expect(result).toContain('class3')
  })

  it('handles conditional classes', () => {
    const condition = true
    const result = cn('base', condition && 'conditional')
    expect(result).toContain('base')
    expect(result).toContain('conditional')
  })

  it('excludes falsy conditional classes', () => {
    const condition = false
    const result = cn('base', condition && 'conditional')
    expect(result).toContain('base')
    expect(result).not.toContain('conditional')
  })

  it('uses tailwind-merge for conflicts', () => {
    // tailwind-merge should resolve conflicts (e.g., p-2 and p-4 -> p-4)
    const result = cn('p-2', 'p-4')
    // Should only contain one padding class
    expect(result).not.toMatch(/p-2.*p-4|p-4.*p-2/)
  })

  it('handles arrays', () => {
    const result = cn(['class1', 'class2'], 'class3')
    expect(result).toContain('class1')
    expect(result).toContain('class2')
    expect(result).toContain('class3')
  })

  it('handles objects', () => {
    const result = cn({ class1: true, class2: false, class3: true })
    expect(result).toContain('class1')
    expect(result).not.toContain('class2')
    expect(result).toContain('class3')
  })

  it('handles empty input', () => {
    const result = cn()
    expect(result).toBe('')
  })
})

