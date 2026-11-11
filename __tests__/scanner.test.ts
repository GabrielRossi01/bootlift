/**
 * Testes de src/scanner.ts: quais arquivos são lidos, quais são ignorados.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  MAX_FILE_BYTES,
  classify,
  countByScope,
  scan,
  shouldEnter
} from '../src/scanner.js'

const WORKSPACE = process.cwd()
const fixture = (name: string) =>
  path.join(WORKSPACE, '__fixtures__/projects', name)

describe('classify', () => {
  it.each([
    ['pom.xml', 'build'],
    ['build.gradle', 'build'],
    ['build.gradle.kts', 'build'],
    ['gradle.properties', 'build'],
    ['gradle-wrapper.properties', 'build'],
    ['libs.versions.toml', 'build'],
    ['application.properties', 'config'],
    ['application-prod.yml', 'config'],
    ['application.yaml', 'config'],
    ['bootstrap.yml', 'config'],
    ['OrderController.java', 'java'],
    ['Extensions.kt', 'java']
  ])('%s → %s', (name, scope) => {
    expect(classify(name)).toBe(scope)
  })

  it.each([
    'README.md',
    'logback.xml',
    'settings.gradle',
    'app.yml',
    'Foo.kts'
  ])('ignora %s', (name) => {
    expect(classify(name)).toBeUndefined()
  })
})

describe('shouldEnter', () => {
  it('pula pastas ocultas e node_modules em qualquer nível', () => {
    for (const dir of ['.git', '.gradle', '.idea', '.mvn', 'node_modules']) {
      expect(shouldEnter(dir, false)).toBe(false)
      expect(shouldEnter(dir, true)).toBe(false)
    }
  })

  it('pula saídas de build só fora de src/', () => {
    for (const dir of ['target', 'build', 'out', 'bin']) {
      expect(shouldEnter(dir, false)).toBe(false)
      expect(shouldEnter(dir, true)).toBe(true)
    }
  })
})

describe('scan nas fixtures', () => {
  it.each([
    ['maven-boot3', { java: 8, build: 1, config: 1 }],
    ['gradle-kts-boot3', { java: 6, build: 3, config: 1 }],
    ['boot4-ready', { java: 5, build: 2, config: 1 }]
  ])('%s', async (name, expected) => {
    const files = await scan(fixture(name), WORKSPACE)

    expect(countByScope(files)).toEqual(expected)
    expect(files.every((f) => f.content.length > 0)).toBe(true)
  })

  it('devolve caminhos relativos ao workspace, com "/" e em ordem', async () => {
    const files = await scan(fixture('maven-boot3'), WORKSPACE)
    const paths = files.map((f) => f.path)

    expect(paths[0]).toBe('__fixtures__/projects/maven-boot3/pom.xml')
    expect(paths.every((p) => !p.includes('\\'))).toBe(true)
    expect(paths).toEqual([...paths].sort())
  })

  it('não lê o expected.json nem o README das fixtures', async () => {
    const files = await scan(
      path.join(WORKSPACE, '__fixtures__/projects'),
      WORKSPACE
    )

    expect(files.some((f) => f.path.endsWith('.json'))).toBe(false)
    expect(files.some((f) => f.path.endsWith('.md'))).toBe(false)
  })
})

describe('scan num projeto com lixo de build', () => {
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'bootlift-scan-'))
    const files: Record<string, string> = {
      'pom.xml': '<project/>',
      'src/main/java/com/acme/App.java': 'class App {}',
      // pacote Java chamado "build" dentro de src/: precisa ser lido
      'src/main/java/com/acme/build/Keep.java': 'class Keep {}',
      'src/main/resources/application.yml': 'server.port: 8080',
      // saídas de build, IDE e dependências: precisam ser ignoradas
      'target/classes/Generated.java': 'class Generated {}',
      'build/generated/pom.xml': '<project/>',
      '.gradle/8.10/Cache.java': 'class Cache {}',
      '.idea/Workspace.java': 'class Workspace {}',
      'frontend/node_modules/lib/pom.xml': '<project/>',
      'module-a/target/pom.xml': '<project/>',
      'module-a/pom.xml': '<project/>'
    }
    for (const [file, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), content)
    }
    await writeFile(
      path.join(root, 'src/main/java/com/acme/Huge.java'),
      'x'.repeat(MAX_FILE_BYTES + 1)
    )
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('lê só o código do usuário', async () => {
    const files = await scan(root, root)

    expect(files.map((f) => f.path)).toEqual([
      'module-a/pom.xml',
      'pom.xml',
      'src/main/java/com/acme/App.java',
      'src/main/java/com/acme/build/Keep.java',
      'src/main/resources/application.yml'
    ])
  })
})
