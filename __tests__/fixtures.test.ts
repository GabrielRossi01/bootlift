/**
 * Garante que as fixtures de projeto e seus expected.json continuam coerentes.
 * Se alguém editar uma fixture e deslocar uma linha, este teste aponta onde.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { RULE_IDS } from '../src/types.js'

interface Located {
  file: string
  line: number
  match: string
}

interface Expected {
  name: string
  build: 'maven' | 'gradle-kts' | 'gradle-groovy'
  bootVersion: string
  expected: (Located & { ruleId: string })[]
  traps: (Located & { reason: string })[]
}

const ROOT = path.resolve('__fixtures__/projects')
const BUILD_FILE = {
  maven: 'pom.xml',
  'gradle-kts': 'build.gradle.kts',
  'gradle-groovy': 'build.gradle'
} as const

const fixtures = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

function load(name: string): Expected {
  return JSON.parse(
    readFileSync(path.join(ROOT, name, 'expected.json'), 'utf8')
  ) as Expected
}

function lineOf(fixture: string, item: Located): string {
  const content = readFileSync(path.join(ROOT, fixture, item.file), 'utf8')
  return content.split('\n')[item.line - 1] ?? ''
}

describe('fixtures de projeto', () => {
  it('existem as 3 fixtures do Dia 1', () => {
    expect(fixtures).toEqual(['boot4-ready', 'gradle-kts-boot3', 'maven-boot3'])
  })

  describe.each(fixtures)('%s', (name) => {
    const data = load(name)

    it('tem expected.json coerente com a pasta', () => {
      expect(data.name).toBe(name)
      expect(existsSync(path.join(ROOT, name, BUILD_FILE[data.build]))).toBe(
        true
      )
    })

    it('usa apenas regras conhecidas', () => {
      for (const item of data.expected) {
        expect(RULE_IDS).toContain(item.ruleId)
      }
    })

    it('aponta para linhas que ainda contêm o trecho esperado', () => {
      for (const item of [...data.expected, ...data.traps]) {
        expect(`${item.file}:${item.line} → ${lineOf(name, item)}`).toContain(
          item.match
        )
      }
    })

    it('não repete o mesmo achado', () => {
      const keys = data.expected.map((e) => `${e.ruleId}@${e.file}:${e.line}`)
      expect(new Set(keys).size).toBe(keys.length)
    })
  })

  it('boot4-ready não espera nenhum achado (zero falso positivo)', () => {
    const data = load('boot4-ready')
    expect(data.bootVersion.startsWith('4.')).toBe(true)
    expect(data.expected).toHaveLength(0)
    expect(data.traps.length).toBeGreaterThan(0)
  })
})
