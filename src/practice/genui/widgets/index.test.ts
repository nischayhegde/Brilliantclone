import { describe, it, expect } from 'vitest'
import { WIDGET_COMPONENTS } from './index'
import { WIDGET_KINDS } from '../registry'

describe('WIDGET_COMPONENTS', () => {
  it('provides a component for every WidgetKind WS-A defined', () => {
    for (const kind of WIDGET_KINDS) {
      expect(typeof WIDGET_COMPONENTS[kind], `missing component for "${kind}"`).toBe('function')
    }
  })

  it('has no extra keys beyond the registry', () => {
    expect(Object.keys(WIDGET_COMPONENTS).sort()).toEqual([...WIDGET_KINDS].sort())
  })
})
