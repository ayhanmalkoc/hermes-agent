import type { Unstable_TriggerItem } from '@assistant-ui/core'
import { describe, expect, it } from 'vitest'

import {
  composerVisibleStatusSessionId,
  pickPlaceholder,
  slashArgStage,
  slashChipKindForItem,
  slashCommandToken
} from './composer-utils'

const item = (group: string): Unstable_TriggerItem =>
  ({ id: 'x', type: 'slash', label: 'x', metadata: { group } }) as unknown as Unstable_TriggerItem

describe('slashArgStage', () => {
  it('is true only once the query is past the command name', () => {
    expect(slashArgStage('personality')).toBe(false)
    expect(slashArgStage('personality alice')).toBe(true)
  })
})

describe('slashCommandToken', () => {
  it('extracts the lowercased /command token', () => {
    expect(slashCommandToken('Personality alice')).toBe('/personality')
    expect(slashCommandToken('model')).toBe('/model')
  })

  it('handles an empty query', () => {
    expect(slashCommandToken('')).toBe('/')
  })
})

describe('slashChipKindForItem', () => {
  it('maps completion groups to chip kinds', () => {
    expect(slashChipKindForItem(item('Skills'))).toBe('skill')
    expect(slashChipKindForItem(item('Themes'))).toBe('theme')
    expect(slashChipKindForItem(item('Commands'))).toBe('command')
  })
})

describe('pickPlaceholder', () => {
  it('returns a member of the pool', () => {
    const pool = ['a', 'b', 'c'] as const
    expect(pool).toContain(pickPlaceholder(pool))
  })
})

describe('composerVisibleStatusSessionId', () => {
  it('prefers the visible stored session over a stale runtime session', () => {
    expect(composerVisibleStatusSessionId('stored-visible', 'runtime-active')).toBe('stored-visible')
  })

  it('falls back to runtime session for a new unsaved chat', () => {
    expect(composerVisibleStatusSessionId(null, 'runtime-active')).toBe('runtime-active')
  })
})
