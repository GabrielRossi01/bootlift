/**
 * Teste de ponta a ponta das regras: cada fixture precisa gerar exatamente os
 * achados do seu expected.json, e nenhum achado nas linhas de armadilha.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { analyze } from '../src/analyze.js'
import { scan } from '../src/scanner.js'

const WORKSPACE = process.cwd()

interface Expected {
  expected: { ruleId: string; file: string; line: number }[]
  traps: { file: string; line: number; reason: string }[]
}

async function run(name: string) {
  const root = path.join(WORKSPACE, '__fixtures__/projects', name)
  const expected = JSON.parse(
    readFileSync(path.join(root, 'expected.json'), 'utf8')
  ) as Expected
  const analysis = analyze(await scan(root, WORKSPACE))
  const prefix = `__fixtures__/projects/${name}/`
  const found = analysis.findings.map(
    (f) => `${f.ruleId}@${f.file.replace(prefix, '')}:${f.line}`
  )
  return { analysis, expected, found }
}

describe.each(['maven-boot3', 'gradle-kts-boot3', 'boot4-ready'])(
  'fixture %s',
  (name) => {
    it('gera exatamente os achados do expected.json', async () => {
      const { expected, found } = await run(name)
      const wanted = expected.expected.map(
        (e) => `${e.ruleId}@${e.file}:${e.line}`
      )
      expect([...found].sort()).toEqual([...wanted].sort())
    })

    it('não acusa nenhuma linha de armadilha (falso positivo)', async () => {
      const { expected, found } = await run(name)
      for (const trap of expected.traps) {
        const hits = found.filter((f) =>
          f.endsWith(`@${trap.file}:${trap.line}`)
        )
        expect({ trap: trap.reason, hits }).toEqual({
          trap: trap.reason,
          hits: []
        })
      }
    })
  }
)

describe('score', () => {
  it('boot4-ready tira 100 e os projetos Boot 3 ficam abaixo', async () => {
    const boot4 = await run('boot4-ready')
    const maven = await run('maven-boot3')
    const gradle = await run('gradle-kts-boot3')

    expect(boot4.analysis.score).toBe(100)
    expect(maven.analysis.score).toBeLessThan(100)
    expect(gradle.analysis.score).toBeLessThan(100)
  })

  it('ordena os achados por severidade, arquivo e linha', async () => {
    const { analysis } = await run('maven-boot3')
    const severities = analysis.findings.map((f) => f.severity)
    const firstWarning = severities.indexOf('warning')
    expect(severities.slice(0, firstWarning).every((s) => s === 'error')).toBe(
      true
    )
    expect(analysis.counts.error).toBe(firstWarning)
  })
})
