import { describe, expect, it } from 'vitest'

import {
  extractPreviewTargets,
  mayContainPreviewTarget,
  normalizeRawFilePreviewTarget,
  previewTargetFromMarkdownHref,
  stripPreviewTargets
} from './preview-targets'

describe('preview target detection', () => {
  it('does not infer preview targets from URLs', () => {
    expect(extractPreviewTargets('Preview: http://localhost:5173/')).toEqual([])
    expect(extractPreviewTargets('Open index.html\nhttp://localhost:5173/tmp/demo.html')).toEqual([])
  })

  it('extracts raw local and remote file paths as preview targets', () => {
    expect(
      extractPreviewTargets([
        'Dosya:',
        '`/var/lib/hermes/Downloads/stock-rabbits/videos/`',
        '- C:\\Users\\me\\Downloads\\rabbit.mp4',
        '- file:///tmp/rabbit.mp4'
      ].join('\n'))
    ).toEqual([
      '/var/lib/hermes/Downloads/stock-rabbits/videos/',
      'C:\\Users\\me\\Downloads\\rabbit.mp4',
      'file:///tmp/rabbit.mp4'
    ])
  })

  it('detects possible preview targets before extraction', () => {
    expect(mayContainPreviewTarget('Dosya: `/var/lib/hermes/out.mp4`')).toBe(true)
    expect(mayContainPreviewTarget('Preview: http://localhost:5173/')).toBe(false)
  })

  it('normalizes raw file targets conservatively', () => {
    expect(normalizeRawFilePreviewTarget('/var/lib/hermes/out.mp4.')).toBe('/var/lib/hermes/out.mp4')
    expect(normalizeRawFilePreviewTarget('http://localhost/out.mp4')).toBeNull()
  })

  it('decodes preview markdown hrefs', () => {
    expect(previewTargetFromMarkdownHref('#preview/%2Ftmp%2Fdemo.html')).toBe('/tmp/demo.html')
    expect(previewTargetFromMarkdownHref('#preview:%2Ftmp%2Fdemo.html')).toBe('/tmp/demo.html')
    expect(previewTargetFromMarkdownHref('#media:%2Ftmp%2Fdemo.mp4')).toBeNull()
  })

  it('extracts preview targets from already-rendered preview markers', () => {
    expect(extractPreviewTargets('[Preview: demo.html](#preview:%2Ftmp%2Fdemo.html)')).toEqual(['/tmp/demo.html'])
  })

  it('strips preview targets from visible assistant text', () => {
    expect(stripPreviewTargets('ready\n/tmp/mycelium-bunnies.html\nopen it')).toBe(
      'ready\n/tmp/mycelium-bunnies.html\nopen it'
    )
    expect(stripPreviewTargets('[Preview: demo.html](#preview:%2Ftmp%2Fdemo.html)\nopen it')).toBe('open it')
  })
})
