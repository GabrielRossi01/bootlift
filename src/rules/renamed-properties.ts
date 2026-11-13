/**
 * Propriedades renomeadas no Spring Boot 4.0.
 *
 * Fonte: receita SpringBootProperties_4_0 do OpenRewrite (rewrite-spring,
 * spring-boot-40-properties.yml, licença Apache-2.0), que segue o guia oficial
 * de migração. Cada chave também vale para as subchaves: `spring.jackson.read`
 * cobre `spring.jackson.read.ACCEPT_SINGLE_VALUE_AS_ARRAY`, por exemplo.
 */
export const RENAMED_PROPERTIES: ReadonlyArray<readonly [string, string]> = [
  ['management.health.mongo.enabled', 'management.health.mongodb.enabled'],
  [
    'management.metrics.mongo.command.enabled',
    'management.metrics.mongodb.command.enabled'
  ],
  [
    'management.metrics.mongo.connectionpool.enabled',
    'management.metrics.mongodb.connectionpool.enabled'
  ],
  [
    'management.otlp.logging.compression',
    'management.opentelemetry.logging.export.otlp.compression'
  ],
  [
    'management.otlp.logging.connect-timeout',
    'management.opentelemetry.logging.export.otlp.connect-timeout'
  ],
  [
    'management.otlp.logging.endpoint',
    'management.opentelemetry.logging.export.otlp.endpoint'
  ],
  [
    'management.otlp.logging.export.enabled',
    'management.logging.export.otlp.enabled'
  ],
  [
    'management.otlp.logging.headers',
    'management.opentelemetry.logging.export.otlp.headers'
  ],
  [
    'management.otlp.logging.timeout',
    'management.opentelemetry.logging.export.otlp.timeout'
  ],
  [
    'management.otlp.logging.transport',
    'management.opentelemetry.logging.export.otlp.transport'
  ],
  [
    'management.otlp.tracing.compression',
    'management.opentelemetry.tracing.export.otlp.compression'
  ],
  [
    'management.otlp.tracing.connect-timeout',
    'management.opentelemetry.tracing.export.otlp.connect-timeout'
  ],
  [
    'management.otlp.tracing.endpoint',
    'management.opentelemetry.tracing.export.otlp.endpoint'
  ],
  [
    'management.otlp.tracing.export.enabled',
    'management.tracing.export.otlp.enabled'
  ],
  [
    'management.otlp.tracing.headers',
    'management.opentelemetry.tracing.export.otlp.headers'
  ],
  [
    'management.otlp.tracing.timeout',
    'management.opentelemetry.tracing.export.otlp.timeout'
  ],
  [
    'management.otlp.tracing.transport',
    'management.opentelemetry.tracing.export.otlp.transport'
  ],
  [
    'management.tracing.brave.span-joining-supported',
    'management.brave.tracing.span-joining-supported'
  ],
  ['management.tracing.enabled', 'management.tracing.export.enabled'],
  [
    'management.tracing.opentelemetry.export.include-unsampled',
    'management.opentelemetry.tracing.export.include-unsampled'
  ],
  [
    'management.tracing.opentelemetry.export.max-batch-size',
    'management.opentelemetry.tracing.export.max-batch-size'
  ],
  [
    'management.tracing.opentelemetry.export.max-queue-size',
    'management.opentelemetry.tracing.export.max-queue-size'
  ],
  [
    'management.tracing.opentelemetry.export.schedule-delay',
    'management.opentelemetry.tracing.export.schedule-delay'
  ],
  [
    'management.tracing.opentelemetry.export.timeout',
    'management.opentelemetry.tracing.export.timeout'
  ],
  [
    'management.zipkin.tracing.connect-timeout',
    'management.tracing.export.zipkin.connect-timeout'
  ],
  [
    'management.zipkin.tracing.encoding',
    'management.tracing.export.zipkin.encoding'
  ],
  [
    'management.zipkin.tracing.endpoint',
    'management.tracing.export.zipkin.endpoint'
  ],
  [
    'management.zipkin.tracing.export.enabled',
    'management.tracing.export.zipkin.enabled'
  ],
  [
    'management.zipkin.tracing.read-timeout',
    'management.tracing.export.zipkin.read-timeout'
  ],
  [
    'server.error.include-binding-errors',
    'spring.web.error.include-binding-errors'
  ],
  ['server.error.include-exception', 'spring.web.error.include-exception'],
  ['server.error.include-message', 'spring.web.error.include-message'],
  ['server.error.include-path', 'spring.web.error.include-path'],
  ['server.error.include-stacktrace', 'spring.web.error.include-stacktrace'],
  ['server.error.path', 'spring.web.error.path'],
  ['server.error.whitelabel.enabled', 'spring.web.error.whitelabel.enabled'],
  ['server.servlet.encoding.charset', 'spring.servlet.encoding.charset'],
  ['server.servlet.encoding.enabled', 'spring.servlet.encoding.enabled'],
  ['server.servlet.encoding.force', 'spring.servlet.encoding.force'],
  [
    'server.servlet.encoding.force-request',
    'spring.servlet.encoding.force-request'
  ],
  [
    'server.servlet.encoding.force-response',
    'spring.servlet.encoding.force-response'
  ],
  [
    'spring.dao.exceptiontranslation.enabled',
    'spring.persistence.exceptiontranslation.enabled'
  ],
  ['spring.data.mongodb.additional-hosts', 'spring.mongodb.additional-hosts'],
  [
    'spring.data.mongodb.authentication-database',
    'spring.mongodb.authentication-database'
  ],
  ['spring.data.mongodb.database', 'spring.mongodb.database'],
  ['spring.data.mongodb.host', 'spring.mongodb.host'],
  ['spring.data.mongodb.password', 'spring.mongodb.password'],
  ['spring.data.mongodb.port', 'spring.mongodb.port'],
  ['spring.data.mongodb.protocol', 'spring.mongodb.protocol'],
  ['spring.data.mongodb.replica-set-name', 'spring.mongodb.replica-set-name'],
  ['spring.data.mongodb.ssl.bundle', 'spring.mongodb.ssl.bundle'],
  ['spring.data.mongodb.ssl.enabled', 'spring.mongodb.ssl.enabled'],
  ['spring.data.mongodb.uri', 'spring.mongodb.uri'],
  ['spring.data.mongodb.username', 'spring.mongodb.username'],
  [
    'spring.data.mongodb.uuid-representation',
    'spring.mongodb.representation.uuid'
  ],
  ['spring.http.client.connect-timeout', 'spring.http.clients.connect-timeout'],
  ['spring.http.client.factory', 'spring.http.clients.imperative.factory'],
  ['spring.http.client.read-timeout', 'spring.http.clients.read-timeout'],
  ['spring.http.client.redirects', 'spring.http.clients.redirects'],
  ['spring.http.client.ssl.bundle', 'spring.http.clients.ssl.bundle'],
  [
    'spring.http.reactiveclient.connect-timeout',
    'spring.http.clients.connect-timeout'
  ],
  [
    'spring.http.reactiveclient.connector',
    'spring.http.clients.reactive.connector'
  ],
  [
    'spring.http.reactiveclient.read-timeout',
    'spring.http.clients.read-timeout'
  ],
  ['spring.http.reactiveclient.redirects', 'spring.http.clients.redirects'],
  ['spring.http.reactiveclient.ssl.bundle', 'spring.http.clients.ssl.bundle'],
  ['spring.jackson.read', 'spring.jackson.json.read'],
  ['spring.jackson.write', 'spring.jackson.json.write'],
  [
    'spring.jackson.serialization.write-dates-as-timestamps',
    'spring.jackson.datatype.datetime.write-dates-as-timestamps'
  ],
  [
    'spring.jackson.serialization.write-date-keys-as-timestamps',
    'spring.jackson.datatype.datetime.write-date-keys-as-timestamps'
  ],
  [
    'spring.jackson.serialization.write-dates-with-zone-id',
    'spring.jackson.datatype.datetime.write-dates-with-zone-id'
  ],
  [
    'spring.jackson.serialization.write-dates-with-context-time-zone',
    'spring.jackson.datatype.datetime.write-dates-with-context-time-zone'
  ],
  [
    'spring.jackson.serialization.write-durations-as-timestamps',
    'spring.jackson.datatype.datetime.write-durations-as-timestamps'
  ],
  [
    'spring.jackson.serialization.write-date-timestamps-as-nanoseconds',
    'spring.jackson.datatype.datetime.write-date-timestamps-as-nanoseconds'
  ],
  [
    'spring.jackson.deserialization.adjust-dates-to-context-time-zone',
    'spring.jackson.datatype.datetime.adjust-dates-to-context-time-zone'
  ],
  [
    'spring.jackson.deserialization.read-date-timestamps-as-nanoseconds',
    'spring.jackson.datatype.datetime.read-date-timestamps-as-nanoseconds'
  ],
  [
    'spring.jackson.serialization.write-enums-using-to-string',
    'spring.jackson.datatype.enum.write-enums-using-to-string'
  ],
  [
    'spring.jackson.serialization.write-enums-using-index',
    'spring.jackson.datatype.enum.write-enums-using-index'
  ],
  [
    'spring.jackson.serialization.write-enum-keys-using-index',
    'spring.jackson.datatype.enum.write-enum-keys-using-index'
  ],
  [
    'spring.jackson.deserialization.fail-on-numbers-for-enums',
    'spring.jackson.datatype.enum.fail-on-numbers-for-enums'
  ],
  [
    'spring.jackson.deserialization.read-enums-using-to-string',
    'spring.jackson.datatype.enum.read-enums-using-to-string'
  ],
  [
    'spring.jackson.deserialization.read-unknown-enum-values-as-null',
    'spring.jackson.datatype.enum.read-unknown-enum-values-as-null'
  ],
  [
    'spring.jackson.deserialization.read-unknown-enum-values-using-default-value',
    'spring.jackson.datatype.enum.read-unknown-enum-values-using-default-value'
  ],
  [
    'spring.kafka.retry.topic.backoff.random',
    'spring.kafka.retry.topic.backoff.jitter'
  ],
  [
    'spring.rabbitmq.listener.direct.retry.max-attempts',
    'spring.rabbitmq.listener.direct.retry.max-retries'
  ],
  [
    'spring.rabbitmq.listener.simple.retry.max-attempts',
    'spring.rabbitmq.listener.simple.retry.max-retries'
  ],
  [
    'spring.rabbitmq.template.retry.max-attempts',
    'spring.rabbitmq.template.retry.max-retries'
  ],
  [
    'spring.session.redis.cleanup-cron',
    'spring.session.data.redis.cleanup-cron'
  ],
  [
    'spring.session.redis.configure-action',
    'spring.session.data.redis.configure-action'
  ],
  ['spring.session.redis.flush-mode', 'spring.session.data.redis.flush-mode'],
  ['spring.session.redis.namespace', 'spring.session.data.redis.namespace'],
  [
    'spring.session.redis.repository-type',
    'spring.session.data.redis.repository-type'
  ],
  ['spring.session.redis.save-mode', 'spring.session.data.redis.save-mode'],
  [
    'spring.session.mongodb.collection-name',
    'spring.session.data.mongodb.collection-name'
  ],
  [
    'spring.test.mockmvc.webclient.enabled',
    'spring.test.mockmvc.htmlunit.webclient.enabled'
  ],
  [
    'spring.test.mockmvc.webdriver.enabled',
    'spring.test.mockmvc.htmlunit.webdriver.enabled'
  ],
  [
    'spring.test.webclient.mockrestserviceserver.enabled',
    'spring.test.restclient.mockrestserviceserver.enabled'
  ]
]
