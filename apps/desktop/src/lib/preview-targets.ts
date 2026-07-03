const PREVIEW_MARKDOWN_RE = /\[Preview:[^\]]+\]\((?<href>#preview[:/][^)]+)\)/gi
const RAW_FILE_TARGET_RE = /(^|[\s`("'])(?<target>(?:file:\/\/[^\s`)'"<>]+|[A-Za-z]:[\\/][^\s`)'"<>]+|\/(?!\/)[^\s`)'"<>]+))/g

export function stripPreviewTargets(text: string): string {
  return text
    .replace(PREVIEW_MARKDOWN_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function extractPreviewTargets(text: string): string[] {
  const targets: string[] = []
  const seen = new Set<string>()

  const pushTarget = (target: string | null) => {
    if (target && !seen.has(target)) {
      seen.add(target)
      targets.push(target)
    }
  }

  for (const match of text.matchAll(PREVIEW_MARKDOWN_RE)) {
    pushTarget(previewTargetFromMarkdownHref(match.groups?.href))
  }

  for (const match of text.matchAll(RAW_FILE_TARGET_RE)) {
    pushTarget(normalizeRawFilePreviewTarget(match.groups?.target))
  }

  return targets
}

export function mayContainPreviewTarget(text: string): boolean {
  return /#preview[:/]|file:\/\/|(^|[\s`("'])(?:[A-Za-z]:[\\/]|\/(?!\/))/i.test(text)
}

export function previewMarkdownHref(target: string): string {
  return `#preview/${encodeURIComponent(target)}`
}

export function previewTargetFromMarkdownHref(href?: string): string | null {
  if (!href?.startsWith('#preview:') && !href?.startsWith('#preview/')) {
    return null
  }

  try {
    return decodeURIComponent(href.slice('#preview'.length + 1))
  } catch {
    return null
  }
}

export function normalizeRawFilePreviewTarget(target?: string): string | null {
  const clean = target?.trim().replace(/[),.;:]+$/, '')

  if (!clean) {
    return null
  }

  if (/^https?:\/\//i.test(clean)) {
    return null
  }

  if (/^file:\/\//i.test(clean) || /^[A-Za-z]:[\\/]/.test(clean) || clean.startsWith('/')) {
    return clean
  }

  return null
}

export function previewName(target: string): string {
  try {
    const url = new URL(target)

    if (url.protocol === 'file:') {
      return decodeURIComponent(url.pathname).split(/[\\/]/).filter(Boolean).pop() || target
    }

    const file = url.pathname.split('/').filter(Boolean).pop()

    return file || url.host
  } catch {
    return target.split(/[\\/]/).filter(Boolean).pop() || target
  }
}

export function previewDisplayLabel(target: string): string {
  const escaped = previewName(target).replace(/[[\]\\]/g, '\\$&')

  return `Preview: ${escaped}`
}
