import { describe, expect, it } from 'vitest'

import { extractFileActionTargets, mayContainFileActionTarget } from './file-action-targets'

describe('file action target detection', () => {
  it('extracts supported file paths outside fenced code blocks', () => {
    expect(
      extractFileActionTargets(
        [
          'Files:',
          '- `/var/lib/hermes/hera/report/summary.html`',
          '- /var/lib/hermes/hera/report/notes.md',
          '- /var/lib/hermes/hera/report/mockup.png',
          '- /var/lib/hermes/hera/report/demo.mp4.'
        ].join('\n')
      )
    ).toEqual([
      '/var/lib/hermes/hera/report/summary.html',
      '/var/lib/hermes/hera/report/notes.md',
      '/var/lib/hermes/hera/report/mockup.png',
      '/var/lib/hermes/hera/report/demo.mp4'
    ])
  })

  it('ignores file paths inside fenced code blocks', () => {
    const text = ['Visible /var/lib/hermes/out.html', '```txt', '/var/lib/hermes/inside.html', '```'].join('\n')

    expect(extractFileActionTargets(text)).toEqual(['/var/lib/hermes/out.html'])
    expect(mayContainFileActionTarget(['```txt', '/var/lib/hermes/inside.html', '```'].join('\n'))).toBe(false)
  })

  it('ignores paths without supported file extensions', () => {
    expect(extractFileActionTargets('Directory: `/var/lib/hermes/hera/outputs/`')).toEqual([])
  })
})

