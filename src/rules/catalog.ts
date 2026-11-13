import type { Rule } from '../types.js'

/**
 * Catálogo das regras aplicadas linha a linha.
 *
 * Cada regra é só um objeto de dados: para criar uma nova, basta acrescentar
 * um item aqui e um teste em __tests__/rules.test.ts. O TypeScript confere
 * `id`, `severity` e `scope` em tempo de compilação.
 *
 * As regras de versão (BOOT_VERSION, JAVA_BASELINE, GRADLE_VERSION) e de
 * propriedades (PROPERTY_RENAMED) têm lógica própria e não estão aqui.
 */

export const MIGRATION_GUIDE =
  'https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide'

/** Pacotes da Jakarta EE que ainda aparecem como javax.* em código antigo. */
const JAKARTA_PACKAGES = [
  'servlet',
  'persistence',
  'validation',
  'transaction(?!\\.xa\\b)', // javax.transaction.xa é do JDK
  'inject',
  'ws\\.rs',
  'xml\\.bind',
  'jms',
  'mail',
  'websocket',
  'faces',
  'ejb',
  'el',
  'json',
  'activation',
  'security\\.enterprise',
  // javax.annotation.Nonnull (JSR 305) e javax.annotation.processing.* ficam de fora
  'annotation\\.(?:PostConstruct|PreDestroy|Resource|Resources|Priority|Generated|ManagedBean|security)'
].join('|')

const IMPORT = '^(\\s*import\\s+(?:static\\s+)?)'

export const RULES: readonly Rule[] = [
  // ------------------------------------------------------------- código
  {
    id: 'JAKARTA_NAMESPACE',
    severity: 'error',
    scope: 'java',
    pattern: `${IMPORT}javax\\.(${JAKARTA_PACKAGES})\\b`,
    replace: '$1jakarta.$2',
    message:
      'Pacote javax.* da Jakarta EE: o Spring Boot 4 usa Jakarta EE 11 (jakarta.*)',
    fix: 'Troque javax. por jakarta. no import',
    docs: MIGRATION_GUIDE
  },
  {
    id: 'JACKSON3_NAMESPACE',
    severity: 'error',
    scope: 'java',
    pattern: `${IMPORT}com\\.fasterxml\\.jackson\\.(?!annotation\\b)`,
    message:
      'Jackson 2: o Spring Boot 4 usa Jackson 3, com pacote tools.jackson',
    fix: 'Use tools.jackson.* e revise classes renomeadas (ex.: JsonProcessingException → JacksonException). As anotações continuam em com.fasterxml.jackson.annotation',
    docs: MIGRATION_GUIDE
  },
  {
    id: 'MOCKBEAN_REMOVED',
    severity: 'error',
    scope: 'java',
    pattern: `${IMPORT}org\\.springframework\\.boot\\.test\\.mock\\.mockito\\.MockBean\\b`,
    replace:
      '$1org.springframework.test.context.bean.override.mockito.MockitoBean',
    message: '@MockBean foi removido no Spring Boot 4',
    fix: 'Importe org.springframework.test.context.bean.override.mockito.MockitoBean',
    docs: MIGRATION_GUIDE
  },
  {
    id: 'MOCKBEAN_REMOVED',
    severity: 'error',
    scope: 'java',
    pattern: `${IMPORT}org\\.springframework\\.boot\\.test\\.mock\\.mockito\\.SpyBean\\b`,
    replace:
      '$1org.springframework.test.context.bean.override.mockito.MockitoSpyBean',
    message: '@SpyBean foi removido no Spring Boot 4',
    fix: 'Importe org.springframework.test.context.bean.override.mockito.MockitoSpyBean',
    docs: MIGRATION_GUIDE
  },
  {
    id: 'MOCKBEAN_REMOVED',
    severity: 'error',
    scope: 'java',
    pattern: '@MockBean\\b',
    replace: '@MockitoBean',
    message: '@MockBean foi removido no Spring Boot 4',
    fix: 'Use @MockitoBean',
    docs: MIGRATION_GUIDE
  },
  {
    id: 'MOCKBEAN_REMOVED',
    severity: 'error',
    scope: 'java',
    pattern: '@SpyBean\\b',
    replace: '@MockitoSpyBean',
    message: '@SpyBean foi removido no Spring Boot 4',
    fix: 'Use @MockitoSpyBean',
    docs: MIGRATION_GUIDE
  },

  // ------------------------------------------------------------- build
  {
    id: 'UNDERTOW_REMOVED',
    severity: 'error',
    scope: 'build',
    pattern: '\\bspring-boot-starter-undertow\\b',
    message: 'Undertow foi removido: ainda não é compatível com Servlet 6.1',
    fix: 'Use o Tomcat (padrão) ou o Jetty (spring-boot-starter-jetty)',
    docs: MIGRATION_GUIDE
  },
  {
    id: 'SPOCK_REMOVED',
    severity: 'warning',
    scope: 'build',
    pattern: '\\bspock-spring\\b',
    message:
      'A integração com o Spock saiu do Spring Boot 4.0 (o Spock ainda não suporta Groovy 5)',
    fix: 'Migre esses testes para JUnit 5 ou mire o Spring Boot 4.1, em que o time do Spring anunciou o retorno da integração',
    docs: MIGRATION_GUIDE
  },
  {
    id: 'SESSION_REMOVED',
    severity: 'error',
    scope: 'build',
    pattern: '\\bspring-session-(?:data-mongodb|hazelcast)\\b',
    message:
      'O Spring Boot 4 não configura mais Spring Session MongoDB/Hazelcast (os projetos passaram para os times do MongoDB e da Hazelcast)',
    fix: 'Siga a documentação do próprio projeto de sessão, com versão explícita, ou migre para Redis/JDBC',
    docs: MIGRATION_GUIDE
  },
  ...renamedStarter('web', 'webmvc'),
  ...renamedStarter('web-services', 'webservices'),
  ...renamedStarter('aop', 'aspectj'),
  ...renamedStarter('oauth2-client', 'security-oauth2-client'),
  ...renamedStarter(
    'oauth2-resource-server',
    'security-oauth2-resource-server'
  ),
  ...renamedStarter(
    'oauth2-authorization-server',
    'security-oauth2-authorization-server'
  ),
  {
    id: 'LAUNCH_SCRIPT',
    severity: 'warning',
    scope: 'build',
    pattern: '<executable>\\s*true\\s*</executable>|\\blaunchScript\\s*\\(',
    message: 'O launch script do jar executável foi removido no Spring Boot 4',
    fix: 'Rode com java -jar ou use o plugin application do Gradle / um serviço systemd',
    docs: MIGRATION_GUIDE
  }
]

/** Escapa todos os caracteres especiais de regex (inclusive a barra invertida). */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renamedStarter(from: string, to: string): Rule[] {
  return [
    {
      id: 'STARTER_RENAMED',
      severity: 'warning',
      scope: 'build',
      // (?![\w-]) evita casar spring-boot-starter-webflux, -web-services, -webmvc...
      pattern: `\\bspring-boot-starter-${escapeRegExp(from)}(?![\\w-])`,
      replace: `spring-boot-starter-${to}`,
      message: `spring-boot-starter-${from} foi renomeado no Spring Boot 4`,
      fix: `Use spring-boot-starter-${to}`,
      docs: MIGRATION_GUIDE
    }
  ]
}
