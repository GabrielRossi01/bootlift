/**
 * Testes de src/config.ts: leitura e validação dos inputs do action.yml.
 */
import { isPullRequestEvent, readConfig } from '../src/config.js'

function inputs(values: Record<string, string>) {
  return (name: string) => values[name] ?? ''
}

describe('readConfig', () => {
  it('aplica os defaults do action.yml', () => {
    const config = readConfig(inputs({ 'github-token': 't0k3n' }), 'push')

    expect(config).toEqual({
      path: '.',
      mode: 'full',
      failOn: 'error',
      commentOnPr: true,
      token: 't0k3n'
    })
  })

  it.each([
    ['pull_request', 'guardrail'],
    ['pull_request_target', 'guardrail'],
    ['push', 'full'],
    ['schedule', 'full'],
    [undefined, 'full']
  ])('mode vazio no evento %s vira %s', (event, expected) => {
    expect(readConfig(inputs({}), event).mode).toBe(expected)
  })

  it('respeita mode e fail-on explícitos, sem diferenciar maiúsculas', () => {
    const config = readConfig(
      inputs({ mode: 'FULL', 'fail-on': 'Warning', path: ' app ' }),
      'pull_request'
    )

    expect(config.mode).toBe('full')
    expect(config.failOn).toBe('warning')
    expect(config.path).toBe('app')
  })

  it('lê comment-on-pr como booleano', () => {
    expect(readConfig(inputs({ 'comment-on-pr': 'false' })).commentOnPr).toBe(
      false
    )
    expect(readConfig(inputs({ 'comment-on-pr': 'TRUE' })).commentOnPr).toBe(
      true
    )
  })

  it.each([
    [{ mode: 'autofix' }, /Input "mode" inválido: "autofix"/],
    [{ 'fail-on': 'critical' }, /Input "fail-on" inválido: "critical"/],
    [{ 'comment-on-pr': 'yes' }, /Input "comment-on-pr" inválido: "yes"/]
  ])('rejeita input inválido %o', (values, message) => {
    expect(() => readConfig(inputs(values), 'push')).toThrow(message)
  })
})

describe('isPullRequestEvent', () => {
  it('reconhece só eventos de pull request', () => {
    expect(isPullRequestEvent('pull_request')).toBe(true)
    expect(isPullRequestEvent('push')).toBe(false)
    expect(isPullRequestEvent(undefined)).toBe(false)
  })
})
