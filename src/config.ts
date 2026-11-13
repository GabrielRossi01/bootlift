import type { Config, FailOn, Mode } from './types.js'

const MODES: readonly Mode[] = ['guardrail', 'full']
const FAIL_ON: readonly FailOn[] = ['none', 'warning', 'error']
const PR_EVENTS = new Set(['pull_request', 'pull_request_target'])

type InputReader = (name: string) => string

/** true quando o workflow foi disparado por um pull request. */
export function isPullRequestEvent(eventName: string | undefined): boolean {
  return PR_EVENTS.has(eventName ?? '')
}

/**
 * Lê e valida os inputs do action.yml.
 *
 * `mode` vazio vira `guardrail` em pull requests e `full` nos demais eventos.
 * Recebe o leitor de inputs por parâmetro para ser testável sem mocks.
 */
export function readConfig(getInput: InputReader, eventName?: string): Config {
  const modeInput = getInput('mode').trim().toLowerCase()
  const mode: Mode =
    modeInput === ''
      ? isPullRequestEvent(eventName)
        ? 'guardrail'
        : 'full'
      : oneOf('mode', modeInput, MODES)

  const failOn = oneOf(
    'fail-on',
    (getInput('fail-on').trim() || 'error').toLowerCase(),
    FAIL_ON
  )

  return {
    path: getInput('path').trim() || '.',
    mode,
    failOn,
    commentOnPr: parseBoolean('comment-on-pr', getInput('comment-on-pr'), true),
    suggestions: parseBoolean('suggestions', getInput('suggestions'), true),
    token: getInput('github-token')
  }
}

function oneOf<T extends string>(
  name: string,
  value: string,
  allowed: readonly T[]
): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new Error(
    `Input "${name}" inválido: "${value}". Use um de: ${allowed.join(' | ')}.`
  )
}

function parseBoolean(name: string, raw: string, fallback: boolean): boolean {
  const value = raw.trim().toLowerCase()
  if (value === '') return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`Input "${name}" inválido: "${raw}". Use true ou false.`)
}
