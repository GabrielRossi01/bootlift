/**
 * Tipos compartilhados do Bootlift.
 *
 * Cada ocorrência encontrada no projeto vira um `Finding`. As regras por linha
 * ficam em src/rules/catalog.ts; as de versão e de propriedades têm lógica
 * própria (src/rules/versions.ts e src/rules/properties.ts).
 */

export type Severity = 'info' | 'warning' | 'error'

/** Onde a regra procura: código Java/Kotlin, arquivos de build ou de config. */
export type Scope = 'java' | 'build' | 'config'

/** guardrail = só linhas adicionadas no PR bloqueiam; full = tudo bloqueia. */
export type Mode = 'guardrail' | 'full'

/** Severidade mínima que reprova o job. */
export type FailOn = 'none' | 'warning' | 'error'

/** Regras do MVP v1.0 (tabela "Regras do MVP" do guia). */
export const RULE_IDS = [
  'BOOT_VERSION',
  'JAVA_BASELINE',
  'GRADLE_VERSION',
  'JAKARTA_NAMESPACE',
  'JACKSON3_NAMESPACE',
  'MOCKBEAN_REMOVED',
  'UNDERTOW_REMOVED',
  'SPOCK_REMOVED',
  'SESSION_REMOVED',
  'STARTER_RENAMED',
  'LAUNCH_SCRIPT',
  'PROPERTY_RENAMED'
] as const

export type RuleId = (typeof RULE_IDS)[number]

export interface SourceFile {
  scope: Scope
  /** Caminho relativo ao workspace, com "/" como separador. */
  path: string
  content: string
}

export type BuildTool = 'maven' | 'gradle'

/** Uma versão encontrada no projeto e onde ela está declarada. */
export interface VersionRef {
  /** Versão normalizada: "3.3.5", "17" (Java "1.8" vira "8"), "8.10.2". */
  value: string
  file: string
  /** Linha 1-based onde a versão está escrita (é ali que a correção acontece). */
  line: number
  /** De onde veio, ex.: "maven-parent", "gradle-plugin", "version-catalog". */
  source: string
}

/** O que o scanner descobriu sobre o projeto (Dia 2). */
export interface ProjectInfo {
  buildTools: BuildTool[]
  boot: VersionRef[]
  java: VersionRef[]
  gradle: VersionRef[]
}

/** Regra aplicada linha a linha (src/rules/catalog.ts). */
export interface Rule {
  id: RuleId
  severity: Severity
  scope: Scope
  /** Regex aplicada em cada linha (sem flags; comentários já mascarados). */
  pattern: string
  message: string
  fix: string
  docs: string
  /**
   * Substituição determinística aplicada sobre o trecho encontrado, aceitando
   * grupos ($1, $2...). Presente = a regra gera uma correção de 1 clique.
   */
  replace?: string
}

export interface Finding {
  ruleId: RuleId
  severity: Severity
  file: string
  /** Linha 1-based. */
  line: number
  message: string
  fix: string
  docs?: string
  /** A linha inteira já corrigida, quando a regra tem `replace`. */
  suggestion?: string
}

export interface Config {
  path: string
  mode: Mode
  failOn: FailOn
  commentOnPr: boolean
  /** Publica as correções como sugestões de 1 clique no PR (Dia 5). */
  suggestions: boolean
  token: string
}
