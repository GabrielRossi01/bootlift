/**
 * Testes das regras: um caso que deve disparar e um que não deve, por regra,
 * mais versões, propriedades renomeadas, score e fail-on.
 */
import { RULES } from '../src/rules/catalog.js'
import {
  computeScore,
  runRules,
  shouldFail,
  sortFindings
} from '../src/rules/engine.js'
import {
  checkProperties,
  flattenProperties,
  flattenYaml,
  renamedKey
} from '../src/rules/properties.js'
import { checkVersions, compareVersions } from '../src/rules/versions.js'
import type {
  Finding,
  ProjectInfo,
  Scope,
  Severity,
  SourceFile
} from '../src/types.js'

const FILE: Record<Scope, string> = {
  java: 'src/main/java/App.java',
  build: 'pom.xml',
  config: 'src/main/resources/application.properties'
}

function check(scope: Scope, line: string, filePath = FILE[scope]): Finding[] {
  return runRules([{ scope, path: filePath, content: line }])
}

describe('regras de linha', () => {
  it.each([
    // [regra, escopo, linha que DEVE disparar, sugestão esperada (ou null)]
    [
      'JAKARTA_NAMESPACE',
      'java',
      'import javax.servlet.http.HttpServletRequest;',
      'import jakarta.servlet.http.HttpServletRequest;'
    ],
    [
      'JAKARTA_NAMESPACE',
      'java',
      'import javax.persistence.Entity;',
      'import jakarta.persistence.Entity;'
    ],
    [
      'JAKARTA_NAMESPACE',
      'java',
      'import static javax.validation.Validation.buildDefaultValidatorFactory;',
      'import static jakarta.validation.Validation.buildDefaultValidatorFactory;'
    ],
    [
      'JAKARTA_NAMESPACE',
      'java',
      'import javax.annotation.PostConstruct;',
      'import jakarta.annotation.PostConstruct;'
    ],
    [
      'JAKARTA_NAMESPACE',
      'java',
      'import javax.transaction.Transactional',
      'import jakarta.transaction.Transactional'
    ],
    [
      'JACKSON3_NAMESPACE',
      'java',
      'import com.fasterxml.jackson.databind.ObjectMapper;',
      null
    ],
    [
      'JACKSON3_NAMESPACE',
      'java',
      'import com.fasterxml.jackson.core.type.TypeReference',
      null
    ],
    [
      'MOCKBEAN_REMOVED',
      'java',
      'import org.springframework.boot.test.mock.mockito.MockBean;',
      'import org.springframework.test.context.bean.override.mockito.MockitoBean;'
    ],
    [
      'MOCKBEAN_REMOVED',
      'java',
      'import org.springframework.boot.test.mock.mockito.SpyBean;',
      'import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;'
    ],
    [
      'MOCKBEAN_REMOVED',
      'java',
      '    @MockBean private Repo repo;',
      '    @MockitoBean private Repo repo;'
    ],
    ['MOCKBEAN_REMOVED', 'java', '    @SpyBean', '    @MockitoSpyBean'],
    [
      'UNDERTOW_REMOVED',
      'build',
      '<artifactId>spring-boot-starter-undertow</artifactId>',
      null
    ],
    [
      'SPOCK_REMOVED',
      'build',
      'testImplementation "org.spockframework:spock-spring:2.3-groovy-4.0"',
      null
    ],
    [
      'SESSION_REMOVED',
      'build',
      '<artifactId>spring-session-hazelcast</artifactId>',
      null
    ],
    [
      'SESSION_REMOVED',
      'build',
      'implementation("org.springframework.session:spring-session-data-mongodb")',
      null
    ],
    [
      'STARTER_RENAMED',
      'build',
      '<artifactId>spring-boot-starter-web</artifactId>',
      '<artifactId>spring-boot-starter-webmvc</artifactId>'
    ],
    [
      'STARTER_RENAMED',
      'build',
      "implementation 'org.springframework.boot:spring-boot-starter-web-services'",
      "implementation 'org.springframework.boot:spring-boot-starter-webservices'"
    ],
    [
      'STARTER_RENAMED',
      'build',
      'implementation("org.springframework.boot:spring-boot-starter-aop")',
      'implementation("org.springframework.boot:spring-boot-starter-aspectj")'
    ],
    [
      'STARTER_RENAMED',
      'build',
      '<artifactId>spring-boot-starter-oauth2-client</artifactId>',
      '<artifactId>spring-boot-starter-security-oauth2-client</artifactId>'
    ],
    ['LAUNCH_SCRIPT', 'build', '<executable>true</executable>', null],
    ['LAUNCH_SCRIPT', 'build', 'bootJar { launchScript() }', null]
  ] as const)('%s dispara em: %s', (ruleId, scope, line, suggestion) => {
    const filePath = line.startsWith('bootJar') ? 'build.gradle' : undefined
    const findings = check(scope, line, filePath)
    expect(findings.map((f) => f.ruleId)).toEqual([ruleId])
    expect(findings[0].suggestion ?? null).toBe(suggestion)
  })

  it.each([
    ['java', 'import javax.sql.DataSource;'],
    ['java', 'import javax.crypto.Mac;'],
    ['java', 'import javax.annotation.Nonnull;'],
    ['java', 'import javax.annotation.processing.Generated;'],
    ['java', 'import javax.transaction.xa.XAResource;'],
    ['java', 'import com.fasterxml.jackson.annotation.JsonProperty;'],
    ['java', 'import tools.jackson.databind.json.JsonMapper;'],
    ['java', '    @MockitoBean'],
    ['java', '    @MockitoSpyBean'],
    ['java', '// import javax.servlet.Filter;'],
    ['java', ' * @MockBean em javadoc'],
    ['build', '<artifactId>spring-boot-starter-webmvc</artifactId>'],
    ['build', '<artifactId>spring-boot-starter-webflux</artifactId>'],
    ['build', '<artifactId>spring-boot-starter-webservices</artifactId>'],
    ['build', '<artifactId>spring-boot-starter-aspectj</artifactId>'],
    [
      'build',
      '<artifactId>spring-boot-starter-security-oauth2-client</artifactId>'
    ],
    ['build', '<artifactId>spring-boot-starter-tomcat</artifactId>'],
    ['build', '<artifactId>spring-session-data-redis</artifactId>'],
    ['build', '<!-- <artifactId>spring-boot-starter-undertow</artifactId> -->'],
    ['build', '<executable>false</executable>']
  ] as const)('não dispara em (%s): %s', (scope, line) => {
    expect(check(scope, line)).toEqual([])
  })

  it('só aplica a regra ao escopo dela', () => {
    expect(check('config', 'import javax.servlet.Filter;')).toEqual([])
    expect(
      check('java', '<artifactId>spring-boot-starter-undertow</artifactId>')
    ).toEqual([])
  })

  it('ignora comentários # em .toml e .properties', () => {
    const toml = runRules([
      {
        scope: 'build',
        path: 'gradle/libs.versions.toml',
        content: '# spock-spring = "x"'
      }
    ])
    expect(toml).toEqual([])
  })

  it('aponta a linha certa e preserva \\r\\n na sugestão', () => {
    const content = 'package a;\r\n\r\nimport javax.servlet.Filter;\r\n'
    const [finding] = runRules([{ scope: 'java', path: 'A.java', content }])
    expect(finding.line).toBe(3)
    expect(finding.suggestion).toBe('import jakarta.servlet.Filter;')
  })

  it('todas as regras do catálogo compilam e têm mensagem, correção e link', () => {
    for (const rule of RULES) {
      expect(() => new RegExp(rule.pattern)).not.toThrow()
      expect(rule.message.length).toBeGreaterThan(10)
      expect(rule.fix.length).toBeGreaterThan(5)
      expect(rule.docs).toMatch(/^https:\/\//)
    }
  })
})

describe('versões', () => {
  it.each([
    ['3.4.1', '3.5', -1],
    ['3.5', '3.5.0', 0],
    ['3.5.7', '3.5', 1],
    ['4.0.0-RC1', '4.0.0', -1],
    ['4.0.0-SNAPSHOT', '4.0', -1],
    ['3.5.0.M1', '3.5.0', -1],
    ['8.10.2', '8.14', -1],
    ['9.1.0', '8.14', 1],
    ['11', '17', -1]
  ])('compareVersions(%s, %s) tem sinal %i', (a, b, sign) => {
    expect(Math.sign(compareVersions(a, b))).toBe(sign)
  })

  const ref = (value: string) => ({
    value,
    file: 'pom.xml',
    line: 1,
    source: 't'
  })
  const project = (p: Partial<ProjectInfo>): ProjectInfo => ({
    buildTools: ['maven'],
    boot: [],
    java: [],
    gradle: [],
    ...p
  })

  it.each([
    ['2.7.18', 'warning'],
    ['3.4.1', 'warning'],
    ['3.5.7', 'info'],
    ['4.0.0', null],
    ['4.1.0', null]
  ])('Spring Boot %s → %s', (version, severity) => {
    const findings = checkVersions(project({ boot: [ref(version)] }))
    expect(findings.map((f) => f.severity)).toEqual(severity ? [severity] : [])
  })

  it('Java abaixo de 17 é erro', () => {
    expect(checkVersions(project({ java: [ref('11')] }))[0]).toMatchObject({
      ruleId: 'JAVA_BASELINE',
      severity: 'error'
    })
    expect(checkVersions(project({ java: [ref('17'), ref('25')] }))).toEqual([])
  })

  it('Gradle abaixo de 8.14 é erro', () => {
    expect(
      checkVersions(project({ gradle: [ref('8.10.2')] }))[0]
    ).toMatchObject({
      ruleId: 'GRADLE_VERSION',
      severity: 'error'
    })
    expect(
      checkVersions(project({ gradle: [ref('8.14.3'), ref('9.2.1')] }))
    ).toEqual([])
  })
})

describe('propriedades renomeadas', () => {
  it('achata YAML aninhado, chaves com ponto, listas, blocos e documentos', () => {
    const yaml = [
      'spring:', //                         1
      '  data:', //                         2
      '    mongodb:', //                    3
      '      uri: mongodb://x # comentário', // 4
      '  jackson.read.accept-single-value-as-array: true', // 5
      'server:', //                         6
      '  port: 8080', //                    7
      'logging:', //                        8
      '  pattern:', //                      9
      '    console: |', //                 10
      '      key: not-a-key', //           11
      'features:', //                       12
      '  - name: x', //                    13
      '---', //                             14
      'management.tracing.enabled: false' // 15
    ].join('\n')

    expect(flattenYaml(yaml)).toEqual([
      { key: 'spring.data.mongodb.uri', line: 4 },
      { key: 'spring.jackson.read.accept-single-value-as-array', line: 5 },
      { key: 'server.port', line: 7 },
      { key: 'logging.pattern.console', line: 10 },
      { key: 'management.tracing.enabled', line: 15 }
    ])
  })

  it('lê .properties com =, : e espaço, ignorando comentários e continuações', () => {
    const props = [
      '# comentário',
      'a.b=1',
      'c.d: 2',
      'e.f 3',
      'g.h=um \\',
      '  i.j=continuação',
      '! outro'
    ].join('\n')
    expect(flattenProperties(props).map((k) => k.key)).toEqual([
      'a.b',
      'c.d',
      'e.f',
      'g.h'
    ])
  })

  it.each([
    ['spring.data.mongodb.uri', 'spring.mongodb.uri'],
    [
      'spring.data.mongodb.uuid-representation',
      'spring.mongodb.representation.uuid'
    ],
    [
      'spring.jackson.read.ACCEPT_SINGLE_VALUE_AS_ARRAY',
      'spring.jackson.json.read.ACCEPT_SINGLE_VALUE_AS_ARRAY'
    ],
    ['spring.session.redis.namespace', 'spring.session.data.redis.namespace'],
    [
      'spring.dao.exceptiontranslation.enabled',
      'spring.persistence.exceptiontranslation.enabled'
    ],
    ['management.tracing.enabled', 'management.tracing.export.enabled'],
    ['spring.dataMongodb.uri', undefined],
    ['spring.data.mongodb.auto-index-creation', undefined],
    ['spring.jackson.json.read.allow-trailing-comma', undefined],
    ['spring.session.timeout', undefined]
  ])('renamedKey(%s) = %s', (key, expected) => {
    expect(renamedKey(key)).toBe(expected)
  })

  it('aplica relaxed binding (maiúsculas, - e _)', () => {
    expect(
      renamedKey('SPRING_DATA_MONGODB_URI'.toLowerCase().replace(/_/g, '.'))
    ).toBe('spring.mongodb.uri')
    expect(renamedKey('spring.data.mongodb.replicaSetName')).toBe(
      'spring.mongodb.replica-set-name'
    )
  })

  it('sugere a correção em .properties, mas não em YAML aninhado', () => {
    const files: SourceFile[] = [
      {
        scope: 'config',
        path: 'application.properties',
        content: 'spring.data.mongodb.host=db\n'
      },
      {
        scope: 'config',
        path: 'application.yml',
        content: 'spring:\n  data:\n    mongodb:\n      host: db\n'
      }
    ]
    const [props, yaml] = checkProperties(files)

    expect(props).toMatchObject({
      line: 1,
      fix: 'Use spring.mongodb.host',
      suggestion: 'spring.mongodb.host=db'
    })
    expect(yaml).toMatchObject({
      line: 4,
      fix: 'Use spring.mongodb.host',
      suggestion: undefined
    })
  })
})

describe('score e fail-on', () => {
  const finding = (
    ruleId: Finding['ruleId'],
    severity: Severity,
    line = 1
  ): Finding => ({
    ruleId,
    severity,
    file: 'A.java',
    line,
    message: '',
    fix: ''
  })

  it('cada regra pesa uma vez, +1 por ocorrência extra (até 10)', () => {
    expect(computeScore([])).toBe(100)
    expect(computeScore([finding('JAKARTA_NAMESPACE', 'error')])).toBe(85)
    expect(computeScore([finding('STARTER_RENAMED', 'warning')])).toBe(95)
    expect(computeScore([finding('BOOT_VERSION', 'info')])).toBe(99)
    const many = Array.from({ length: 30 }, (_, i) =>
      finding('JAKARTA_NAMESPACE', 'error', i + 1)
    )
    expect(computeScore(many)).toBe(100 - 15 - 10)
  })

  it('nunca fica abaixo de 0', () => {
    const ids = [
      'JAKARTA_NAMESPACE',
      'JACKSON3_NAMESPACE',
      'MOCKBEAN_REMOVED',
      'UNDERTOW_REMOVED',
      'SESSION_REMOVED',
      'JAVA_BASELINE',
      'GRADLE_VERSION'
    ] as const
    const findings = ids.flatMap((id) =>
      Array.from({ length: 20 }, (_, i) => finding(id, 'error', i))
    )
    expect(computeScore(findings)).toBe(0)
  })

  it.each([
    ['none', ['error'], false],
    ['error', ['warning', 'info'], false],
    ['error', ['error'], true],
    ['warning', ['info'], false],
    ['warning', ['warning'], true]
  ] as const)('fail-on %s com %j → %s', (failOn, severities, expected) => {
    const findings = severities.map((s) => finding('BOOT_VERSION', s))
    expect(shouldFail(findings, failOn)).toBe(expected)
  })

  it('sortFindings: error antes de warning antes de info', () => {
    const sorted = sortFindings([
      finding('BOOT_VERSION', 'info'),
      finding('STARTER_RENAMED', 'warning'),
      finding('JAKARTA_NAMESPACE', 'error')
    ])
    expect(sorted.map((f) => f.severity)).toEqual(['error', 'warning', 'info'])
  })
})
