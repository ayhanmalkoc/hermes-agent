import { describe, expect, it } from 'vitest'

import {
  contentHasVisibleText,
  messageAttachmentRefs,
  messageContentText,
  partText,
  pickPreviewTargets
} from './content'

describe('partText', () => {
  it('returns plain strings as-is', () => {
    expect(partText('hello')).toBe('hello')
  })

  it('reads text from untyped and text parts', () => {
    expect(partText({ text: 'a' })).toBe('a')
    expect(partText({ type: 'text', text: 'b' })).toBe('b')
  })

  it('ignores non-text parts and malformed input', () => {
    expect(partText({ type: 'tool', text: 'x' })).toBe('')
    expect(partText({ text: 42 })).toBe('')
    expect(partText(null)).toBe('')
    expect(partText(undefined)).toBe('')
  })
})

describe('messageContentText', () => {
  it('trims string content', () => {
    expect(messageContentText('  hi  ')).toBe('hi')
  })

  it('concatenates array text parts and trims', () => {
    expect(messageContentText([{ text: ' a' }, { type: 'text', text: 'b ' }])).toBe('ab')
  })

  it('returns empty string for non-string, non-array content', () => {
    expect(messageContentText(null)).toBe('')
    expect(messageContentText({ text: 'x' })).toBe('')
  })
})

describe('contentHasVisibleText', () => {
  it('detects visible text in strings and arrays', () => {
    expect(contentHasVisibleText('hi')).toBe(true)
    expect(contentHasVisibleText([{ text: '   ' }, { text: 'x' }])).toBe(true)
  })

  it('is false when there is no visible text', () => {
    expect(contentHasVisibleText('   ')).toBe(false)
    expect(contentHasVisibleText([{ text: '  ' }, { type: 'tool', text: 'y' }])).toBe(false)
    expect(contentHasVisibleText(null)).toBe(false)
  })
})

describe('messageAttachmentRefs', () => {
  it('returns string arrays untouched', () => {
    const value = ['@file:a', '@file:b']
    expect(messageAttachmentRefs(value)).toBe(value)
  })

  it('returns a stable empty array for invalid input', () => {
    const a = messageAttachmentRefs(null)
    const b = messageAttachmentRefs([1, 2])
    expect(a).toEqual([])
    expect(a).toBe(b)
  })
})

describe('pickPreviewTargets', () => {
  it('returns the input when one or zero targets', () => {
    expect(pickPreviewTargets([])).toEqual([])
    expect(pickPreviewTargets(['https://x.dev'])).toEqual(['https://x.dev'])
  })

  it('keeps multiple localhost and loopback targets', () => {
    expect(
      pickPreviewTargets(['http://localhost:5173/demo', 'https://localhost:5173/demo', 'http://127.0.0.1:3000/preview'])
    ).toEqual(['http://localhost:5173/demo', 'https://localhost:5173/demo', 'http://127.0.0.1:3000/preview'])
  })

  it('caps preview targets to avoid noisy messages', () => {
    expect(pickPreviewTargets(['a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd'])
  })
})
