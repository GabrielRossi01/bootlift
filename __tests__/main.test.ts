/**
 * Testes de src/main.ts com @actions/core mockado (padrão ESM do template).
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { run } = await import('../src/main.js')

function useInputs(values: Record<string, string>) {
  core.getInput.mockImplementation((name: string) => values[name] ?? '')
}

describe('main.ts', () => {
  const env = { ...process.env }

  beforeEach(() => {
    process.env.GITHUB_WORKSPACE = process.cwd()
    process.env.GITHUB_EVENT_NAME = 'push'
  })

  afterEach(() => {
    jest.resetAllMocks()
    process.env = { ...env }
  })

  it('executa sobre uma fixture e loga ok', async () => {
    useInputs({ path: '__fixtures__/projects/maven-boot3' })

    await run()

    expect(core.setFailed).not.toHaveBeenCalled()
    expect(core.info).toHaveBeenCalledWith(
      '  projeto : __fixtures__/projects/maven-boot3'
    )
    expect(core.info).toHaveBeenCalledWith('  modo    : full')
    expect(core.info).toHaveBeenLastCalledWith(
      expect.stringMatching(/^ok — fundação pronta/)
    )
  })

  it('usa o modo guardrail em pull requests', async () => {
    process.env.GITHUB_EVENT_NAME = 'pull_request'
    useInputs({ path: '__fixtures__/projects/boot4-ready' })

    await run()

    expect(core.info).toHaveBeenCalledWith('  modo    : guardrail')
  })

  it('falha quando o diretório não existe', async () => {
    useInputs({ path: 'nao-existe' })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Diretório do projeto não encontrado: "nao-existe"'
    )
  })

  it('falha quando o path aponta para um arquivo', async () => {
    useInputs({ path: 'action.yml' })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Diretório do projeto não encontrado: "action.yml"'
    )
  })

  it('falha com input inválido', async () => {
    useInputs({ 'fail-on': 'sometimes' })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Input "fail-on" inválido')
    )
  })
})
