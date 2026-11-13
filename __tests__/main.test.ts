/**
 * Testes de src/main.ts com @actions/core e @actions/github mockados
 * (padrão ESM do template: jest.unstable_mockModule antes do import).
 */
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import * as core from '../__fixtures__/core.js'
import * as github from '../__fixtures__/github.js'

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => github)

const { run } = await import('../src/main.js')

const MAVEN = '__fixtures__/projects/maven-boot3'
const TEST_FILE = `${MAVEN}/src/test/java/dev/rossi/orders/order/OrderControllerTest.java`

function useInputs(values: Record<string, string>) {
  core.getInput.mockImplementation((name: string) => values[name] ?? '')
}

/** Linha do primeiro @MockBean no teste da fixture Maven (vem do gabarito). */
function mockBeanLine(): number {
  const expected = JSON.parse(
    readFileSync(`${MAVEN}/expected.json`, 'utf8')
  ) as {
    expected: { ruleId: string; file: string; line: number; match: string }[]
  }
  return expected.expected.find((e) => e.match === '    @MockBean')!.line
}

/** Simula um pull_request cujo diff adiciona as linhas indicadas. */
function usePullRequest(
  files: { filename: string; patch?: string }[],
  extra = {}
) {
  process.env.GITHUB_EVENT_NAME = 'pull_request'
  process.env.GITHUB_REPOSITORY = 'GabrielRossi01/bootlift'
  github.context.payload = {
    pull_request: { number: 7, head: { sha: 'abc123' } }
  }
  const fake = github.fakeOctokit({ files, ...extra })
  github.getOctokit.mockReturnValue(fake.octokit)
  return fake
}

const outputs = () =>
  Object.fromEntries(core.setOutput.mock.calls.map(([k, v]) => [k, String(v)]))

describe('main.ts', () => {
  const env = { ...process.env }

  beforeEach(() => {
    process.env = { ...env }
    process.env.GITHUB_WORKSPACE = process.cwd()
    process.env.GITHUB_EVENT_NAME = 'push'
    delete process.env.GITHUB_STEP_SUMMARY
    delete process.env.GITHUB_REPOSITORY
    github.context.payload = {}
    core.summary.text = ''
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    process.env = env
  })

  describe('modo full (push)', () => {
    it('reprova o job quando há erros e define os outputs', async () => {
      useInputs({ path: MAVEN })

      await run()

      expect(core.info).toHaveBeenCalledWith('  modo    : full')
      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Bootlift: 10 achado\(s\) bloqueiam o Spring Boot 4 \(fail-on: error, score 32\/100\)/
        )
      )
      expect(outputs()).toEqual({ score: '32', blocking: '10', errors: '6' })
    })

    it('anota cada achado no arquivo e na linha', async () => {
      useInputs({ path: MAVEN, 'fail-on': 'none' })

      await run()

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining('@MockBean foi removido'),
        {
          title: 'Bootlift: MOCKBEAN_REMOVED',
          file: TEST_FILE,
          startLine: mockBeanLine()
        }
      )
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('spring-boot-starter-web foi renomeado'),
        expect.objectContaining({ title: 'Bootlift: STARTER_RENAMED' })
      )
    })

    it('passa num projeto já no Boot 4, com score 100', async () => {
      useInputs({ path: '__fixtures__/projects/boot4-ready' })

      await run()

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(outputs()).toEqual({ score: '100', blocking: '0', errors: '0' })
      expect(core.info).toHaveBeenLastCalledWith('ok')
    })

    it('fail-on warning também reprova por warnings', async () => {
      useInputs({
        path: '__fixtures__/projects/gradle-kts-boot3',
        'fail-on': 'warning'
      })

      await run()

      expect(core.setFailed).toHaveBeenCalled()
    })

    it('escreve o relatório no job summary quando disponível', async () => {
      process.env.GITHUB_STEP_SUMMARY = '/tmp/summary.md'
      useInputs({ path: MAVEN, 'fail-on': 'none' })

      await run()

      expect(core.summary.write).toHaveBeenCalled()
      expect(core.summary.text).toContain('Spring Boot 4 Readiness: **32/100**')
      expect(core.summary.text).toContain('🔎 **Modo full:**')
    })

    it('não usa a API do GitHub fora de pull requests', async () => {
      useInputs({ path: MAVEN, 'fail-on': 'none', 'github-token': 't' })

      await run()

      expect(github.getOctokit).not.toHaveBeenCalled()
    })
  })

  describe('modo guardrail (pull_request)', () => {
    it('só bloqueia achados em linhas adicionadas pelo PR', async () => {
      const line = mockBeanLine()
      usePullRequest([
        {
          filename: TEST_FILE,
          patch: `@@ -${line},0 +${line},1 @@\n+    @MockBean`
        },
        { filename: `${MAVEN}/README.md`, patch: '@@ -0,0 +1 @@\n+oi' }
      ])
      useInputs({ path: MAVEN, 'github-token': 't', 'comment-on-pr': 'false' })

      await run()

      expect(core.info).toHaveBeenCalledWith('  modo    : guardrail')
      expect(outputs()).toEqual({ score: '32', blocking: '1', errors: '6' })
      expect(core.error).toHaveBeenCalledTimes(1)
      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('1 achado(s) novo(s) neste PR')
      )
    })

    it('publica a correção do @MockBean como sugestão de 1 clique', async () => {
      const line = mockBeanLine()
      const fake = usePullRequest([
        {
          filename: TEST_FILE,
          patch: `@@ -${line},0 +${line},1 @@\n+    @MockBean`
        }
      ])
      useInputs({ path: MAVEN, 'github-token': 't' })

      await run()

      expect(fake.calls.reviews).toHaveLength(1)
      expect(fake.calls.reviews[0]).toMatchObject({
        commit_id: 'abc123',
        event: 'COMMENT',
        comments: [
          expect.objectContaining({
            path: TEST_FILE,
            line,
            body: expect.stringContaining(
              '```suggestion\n    @MockitoBean\n```'
            )
          })
        ]
      })
      expect(fake.calls.created[0]).toContain(
        '1 correção pode ser aplicada em 1 clique'
      )
      expect(core.info).toHaveBeenCalledWith('  sugestões: 1 publicada(s)')
    })

    it('com suggestions: false, não abre review', async () => {
      const line = mockBeanLine()
      const fake = usePullRequest([
        {
          filename: TEST_FILE,
          patch: `@@ -${line},0 +${line},1 @@\n+    @MockBean`
        }
      ])
      useInputs({ path: MAVEN, 'github-token': 't', suggestions: 'false' })

      await run()

      expect(fake.octokit.rest.pulls.createReview).not.toHaveBeenCalled()
      expect(fake.calls.created[0]).not.toContain('1 clique')
    })

    it('não sugere nada para o código legado', async () => {
      const fake = usePullRequest([])
      useInputs({ path: MAVEN, 'github-token': 't' })

      await run()

      expect(fake.octokit.rest.pulls.createReview).not.toHaveBeenCalled()
    })

    it('em PR de fork, avisa que não publicou as sugestões e segue', async () => {
      const line = mockBeanLine()
      usePullRequest(
        [
          {
            filename: TEST_FILE,
            patch: `@@ -${line},0 +${line},1 @@\n+    @MockBean`
          }
        ],
        { failReview: true }
      )
      useInputs({ path: MAVEN, 'github-token': 't', 'fail-on': 'none' })

      await run()

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Não foi possível publicar as sugestões')
      )
      expect(core.setFailed).not.toHaveBeenCalled()
    })

    it('não reprova um PR que não toca no código legado', async () => {
      usePullRequest([{ filename: 'README.md', patch: '@@ -1 +1 @@\n-a\n+b' }])
      useInputs({ path: MAVEN, 'github-token': 't', 'comment-on-pr': 'false' })

      await run()

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(outputs()).toEqual({ score: '32', blocking: '0', errors: '6' })
    })

    it('cria o comentário no PR com o marcador do Bootlift', async () => {
      const fake = usePullRequest([])
      useInputs({ path: MAVEN, 'github-token': 't' })

      await run()

      expect(fake.calls.created).toHaveLength(1)
      expect(fake.calls.created[0]).toMatch(/^<!-- bootlift -->/)
      expect(fake.calls.created[0]).toContain(
        'não adiciona nenhum problema novo'
      )
      expect(fake.calls.created[0]).toContain(
        'https://github.com/GabrielRossi01/bootlift/blob/abc123/'
      )
    })

    it('atualiza o comentário existente em vez de criar outro', async () => {
      const fake = usePullRequest([], {
        comments: [
          { id: 1, body: 'LGTM' },
          { id: 2, body: '<!-- bootlift -->\nrelatório antigo' }
        ]
      })
      useInputs({ path: MAVEN, 'github-token': 't' })

      await run()

      expect(fake.calls.created).toHaveLength(0)
      expect(fake.calls.updated).toHaveLength(1)
      expect(fake.calls.updated[0].id).toBe(2)
    })

    it('em PR de fork (token só leitura) avisa e segue sem comentar', async () => {
      usePullRequest([], { failComments: true })
      useInputs({ path: MAVEN, 'github-token': 't' })

      await run()

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Não foi possível comentar no PR')
      )
      expect(core.setFailed).not.toHaveBeenCalled()
    })

    it('sem token, cai para o modo full e avisa', async () => {
      usePullRequest([])
      useInputs({ path: MAVEN, 'fail-on': 'none' })

      await run()

      expect(github.getOctokit).not.toHaveBeenCalled()
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Sem github-token para ler o diff')
      )
      expect(outputs().blocking).toBe('10')
    })

    it('se o diff falhar, cai para o modo full e avisa', async () => {
      const fake = usePullRequest([])
      fake.octokit.rest.pulls.listFiles.mockRejectedValueOnce(
        new Error('boom') as never
      )
      useInputs({
        path: MAVEN,
        'github-token': 't',
        'fail-on': 'none',
        'comment-on-pr': 'false'
      })

      await run()

      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Não foi possível ler o diff do PR')
      )
      expect(outputs().blocking).toBe('10')
    })
  })

  describe('entradas e projeto', () => {
    it('mostra arquivos lidos e versões encontradas', async () => {
      useInputs({
        path: '__fixtures__/projects/gradle-kts-boot3',
        'fail-on': 'none'
      })

      await run()

      expect(core.info).toHaveBeenCalledWith(
        '  arquivos: 10 (java 6 · build 3 · config 1)'
      )
      expect(core.info).toHaveBeenCalledWith(
        '  Spring Boot: 3.4.1 (__fixtures__/projects/gradle-kts-boot3/build.gradle.kts:4)'
      )
      expect(core.startGroup).toHaveBeenCalledWith('Arquivos analisados')
      expect(core.endGroup).toHaveBeenCalled()
    })

    it('avisa quando a pasta não tem nenhum arquivo de projeto', async () => {
      useInputs({ path: '.github' })

      await run()

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Nenhum arquivo de projeto Java/Spring')
      )
      expect(outputs()).toEqual({ score: '100', blocking: '0', errors: '0' })
    })

    it('falha quando o diretório não existe', async () => {
      useInputs({ path: 'nao-existe' })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Diretório do projeto não encontrado: "nao-existe"'
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
})
