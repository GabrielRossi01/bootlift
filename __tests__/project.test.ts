/**
 * Testes de src/project.ts: extração das versões de Spring Boot, Java e Gradle.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { detectProject, lineAt, mask, normalizeJava } from '../src/project.js'
import { scan } from '../src/scanner.js'
import type { SourceFile } from '../src/types.js'

const WORKSPACE = process.cwd()

/** Monta um SourceFile de build em memória. */
const build = (filePath: string, content: string): SourceFile => ({
  scope: 'build',
  path: filePath,
  content
})

const values = (refs: { value: string }[]) => refs.map((r) => r.value)

describe('detectProject nas fixtures', () => {
  it.each([
    ['maven-boot3', ['maven'], ['3.3.5'], ['17'], []],
    ['gradle-kts-boot3', ['gradle'], ['3.4.1'], ['21'], ['8.10.2']],
    ['boot4-ready', ['gradle'], ['4.0.0'], ['25'], ['8.14.3']]
  ])('%s', async (name, tools, boot, java, gradle) => {
    const root = path.join(WORKSPACE, '__fixtures__/projects', name)
    const info = detectProject(await scan(root, WORKSPACE))

    expect(info.buildTools).toEqual(tools)
    expect(values(info.boot)).toEqual(boot)
    expect(values(info.java)).toEqual(java)
    expect(values(info.gradle)).toEqual(gradle)
  })

  it.each(['maven-boot3', 'gradle-kts-boot3'])(
    '%s: as linhas batem com o expected.json (BOOT_VERSION e GRADLE_VERSION)',
    async (name) => {
      const root = path.join(WORKSPACE, '__fixtures__/projects', name)
      const info = detectProject(await scan(root, WORKSPACE))
      const expected = JSON.parse(
        readFileSync(path.join(root, 'expected.json'), 'utf8')
      ) as { expected: { ruleId: string; file: string; line: number }[] }

      const located = (ruleId: string) =>
        expected.expected
          .filter((e) => e.ruleId === ruleId)
          .map((e) => `__fixtures__/projects/${name}/${e.file}:${e.line}`)
      const actual = (refs: { file: string; line: number }[]) =>
        refs.map((r) => `${r.file}:${r.line}`)

      expect(actual(info.boot)).toEqual(located('BOOT_VERSION'))
      expect(actual(info.gradle)).toEqual(located('GRADLE_VERSION'))
    }
  )
})

describe('Maven', () => {
  it('lê o BOM spring-boot-dependencies e resolve ${propriedade}', () => {
    const pom = [
      '<project>', //                                       1
      '  <properties>', //                                  2
      '    <spring-boot.version>3.2.4</spring-boot.version>', // 3
      '    <maven.compiler.release>21</maven.compiler.release>', // 4
      '  </properties>', //                                 5
      '  <dependencyManagement><dependencies>', //          6
      '    <dependency>', //                                7
      '      <groupId>org.springframework.boot</groupId>', // 8
      '      <artifactId>spring-boot-dependencies</artifactId>', // 9
      '      <version>${spring-boot.version}</version>', // 10
      '    </dependency>', //                               11
      '  </dependencies></dependencyManagement>', //        12
      '</project>'
    ].join('\n')
    const info = detectProject([build('pom.xml', pom)])

    expect(info.boot).toEqual([
      { value: '3.2.4', file: 'pom.xml', line: 3, source: 'maven-bom' }
    ])
    expect(info.java).toEqual([
      {
        value: '21',
        file: 'pom.xml',
        line: 4,
        source: 'maven-maven.compiler.release'
      }
    ])
  })

  it('normaliza Java 1.8 e não duplica release que aponta para java.version', () => {
    const pom = [
      '<project><properties>',
      '  <java.version>1.8</java.version>',
      '</properties>',
      '<build><plugins><plugin>',
      '  <artifactId>maven-compiler-plugin</artifactId>',
      '  <configuration><release>${java.version}</release></configuration>',
      '</plugin></plugins></build></project>'
    ].join('\n')
    const info = detectProject([build('pom.xml', pom)])

    expect(info.java).toEqual([
      { value: '8', file: 'pom.xml', line: 2, source: 'maven-java.version' }
    ])
  })

  it('ignora versões dentro de comentários XML', () => {
    const pom = [
      '<project>',
      '  <!-- <parent><artifactId>spring-boot-starter-parent</artifactId><version>2.7.18</version></parent> -->',
      '  <parent>',
      '    <artifactId>spring-boot-starter-parent</artifactId>',
      '    <version>3.5.0</version>',
      '  </parent>',
      '</project>'
    ].join('\n')

    expect(detectProject([build('pom.xml', pom)]).boot).toEqual([
      { value: '3.5.0', file: 'pom.xml', line: 5, source: 'maven-parent' }
    ])
  })

  it('não confunde outro parent com o do Spring Boot', () => {
    const pom =
      '<project><parent><artifactId>acme-parent</artifactId><version>9.9</version></parent></project>'
    expect(detectProject([build('pom.xml', pom)]).boot).toEqual([])
  })
})

describe('Gradle', () => {
  it('lê o classpath do buildscript, sourceCompatibility e ignora comentários', () => {
    const gradle = [
      'buildscript {',
      '  dependencies { classpath "org.springframework.boot:spring-boot-gradle-plugin:3.1.5" }',
      '}',
      '// id "org.springframework.boot" version "2.7.0"',
      'sourceCompatibility = JavaVersion.VERSION_1_8',
      'repositories { maven { url "https://repo.spring.io/milestone" } }'
    ].join('\n')
    const info = detectProject([build('build.gradle', gradle)])

    expect(info.buildTools).toEqual(['gradle'])
    expect(info.boot).toEqual([
      {
        value: '3.1.5',
        file: 'build.gradle',
        line: 2,
        source: 'gradle-coordinates'
      }
    ])
    expect(info.java).toEqual([
      {
        value: '8',
        file: 'build.gradle',
        line: 5,
        source: 'gradle-compatibility'
      }
    ])
  })

  it('lê jvmToolchain do Kotlin e ignora versões vindas de variável', () => {
    const kts = [
      'plugins { id("org.springframework.boot") version springBootVersion }',
      'kotlin { jvmToolchain(17) }'
    ].join('\n')
    const info = detectProject([build('build.gradle.kts', kts)])

    expect(info.boot).toEqual([])
    expect(values(info.java)).toEqual(['17'])
  })

  it('lê a versão do Boot no version catalog (version.ref e version direta)', () => {
    const toml = [
      '[versions]', //                                          1
      'spring-boot = "3.3.2" # versão do Boot', //            2
      '', //                                                    3
      '[plugins]', //                                           4
      'spring-boot = { id = "org.springframework.boot", version.ref = "spring-boot" }', // 5
      '', //                                                    6
      '[libraries]', //                                         7
      'boot-bom = { module = "org.springframework.boot:spring-boot-dependencies", version = "3.3.2" }' // 8
    ].join('\n')
    const info = detectProject([build('gradle/libs.versions.toml', toml)])

    expect(info.boot).toEqual([
      {
        value: '3.3.2',
        file: 'gradle/libs.versions.toml',
        line: 2,
        source: 'version-catalog'
      },
      {
        value: '3.3.2',
        file: 'gradle/libs.versions.toml',
        line: 8,
        source: 'version-catalog'
      }
    ])
  })

  it('lê springBootVersion do gradle.properties', () => {
    const props = 'org.gradle.jvmargs=-Xmx2g\nspringBootVersion=3.0.13\n'
    expect(detectProject([build('gradle.properties', props)]).boot).toEqual([
      {
        value: '3.0.13',
        file: 'gradle.properties',
        line: 2,
        source: 'gradle-properties'
      }
    ])
  })

  it('lê o wrapper -all.zip', () => {
    const wrapper =
      'distributionBase=GRADLE_USER_HOME\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-9.1.0-all.zip\n'
    expect(
      detectProject([
        build('gradle/wrapper/gradle-wrapper.properties', wrapper)
      ]).gradle
    ).toEqual([
      {
        value: '9.1.0',
        file: 'gradle/wrapper/gradle-wrapper.properties',
        line: 2,
        source: 'gradle-wrapper'
      }
    ])
  })
})

describe('helpers', () => {
  it('mask troca o trecho por espaços e mantém as linhas', () => {
    const original = 'a <!-- x\ny --> b'
    const masked = mask(original, /<!--[\s\S]*?-->/g)
    expect(masked).toBe('a ' + ' '.repeat(6) + '\n' + ' '.repeat(6) + 'b')
    expect(masked).toHaveLength(original.length)
    expect(lineAt(masked, masked.indexOf('b'))).toBe(2)
  })

  it.each([
    ['1.8', '8'],
    ['11', '11'],
    ['17.0', '17'],
    ['21', '21']
  ])('normalizeJava(%s) = %s', (input, output) => {
    expect(normalizeJava(input)).toBe(output)
  })

  it('ignora arquivos que não são de build', () => {
    const java: SourceFile = {
      scope: 'java',
      path: 'A.java',
      content: 'JavaLanguageVersion.of(8)'
    }
    expect(detectProject([java])).toEqual({
      buildTools: [],
      boot: [],
      java: [],
      gradle: []
    })
  })
})
