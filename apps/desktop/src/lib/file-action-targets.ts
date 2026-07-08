const FENCED_CODE_BLOCK_RE = /(^|\n)[ \t]*(?:`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]*(?:`{3,}|~{3,})(?=\n|$)/g
const FILE_ACTION_TARGET_RE = /(^|[\s("'`\[])(?<target>file:\/\/\/[^\s`"')<>\]]+|[A-Za-z]:[\\/][^\s`"')<>\]]+|\/[^\s`"')<>\]]+|~\/[^\s`"')<>\]]+|\.\.?\/[^\s`"')<>\]]+)/g

const SUPPORTED_FILE_ACTION_EXTENSIONS = new Set([
  '.aac',
  '.avi',
  '.bmp',
  '.conf',
  '.cpp',
  '.csv',
  '.css',
  '.flac',
  '.gif',
  '.go',
  '.graphql',
  '.htm',
  '.html',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.jsx',
  '.log',
  '.m4a',
  '.m4v',
  '.markdown',
  '.md',
  '.mov',
  '.mp3',
  '.mp4',
  '.mpeg',
  '.mpg',
  '.ogg',
  '.opus',
  '.png',
  '.py',
  '.rs',
  '.sh',
  '.sql',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.wav',
  '.webm',
  '.webp',
  '.xml',
  '.yaml',
  '.yml'
])

function withoutFencedCodeBlocks(text: string): string {
  return text.replace(FENCED_CODE_BLOCK_RE, '$1')
}

function normalizeCandidate(value: string): string {
  return value.trim().replace(/^`|`$/g, '').replace(/[),.;:]+$/, '')
}

function extension(value: string): string {
  const clean = value.split(/[?#]/, 1)[0] || value
  const idx = clean.lastIndexOf('.')

  return idx >= 0 ? clean.slice(idx).toLowerCase() : ''
}

export function extractFileActionTargets(text: string): string[] {
  const visibleText = withoutFencedCodeBlocks(text)
  const targets: string[] = []
  const seen = new Set<string>()

  for (const match of visibleText.matchAll(FILE_ACTION_TARGET_RE)) {
    const target = normalizeCandidate(match.groups?.target || '')

    if (!target || !SUPPORTED_FILE_ACTION_EXTENSIONS.has(extension(target)) || seen.has(target)) {
      continue
    }

    seen.add(target)
    targets.push(target)
  }

  return targets
}

export function mayContainFileActionTarget(text: string): boolean {
  return /(?:file:\/\/\/|[A-Za-z]:[\\/]|\s\/|`\/|^\/|~\/|\.\.?\/)/.test(withoutFencedCodeBlocks(text))
}
