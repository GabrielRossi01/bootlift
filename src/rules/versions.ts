import type { Finding, ProjectInfo } from '../types.js'
import { MIGRATION_GUIDE } from './catalog.js'

/** Versões mínimas exigidas pelo Spring Boot 4.0. */
export const BASELINE = {
  /** Recomendação oficial: passar pelo último 3.5.x antes do 4.0. */
  boot: '3.5',
  target: '4.0',
  java: '17',
  gradle: '8.14'
} as const

const SYSTEM_REQUIREMENTS =
  'https://docs.spring.io/spring-boot/system-requirements.html'

/**
 * Compara versões numéricas ("3.4.1" < "3.5"). Pré-releases ficam antes da
 * versão final ("4.0.0-RC1" < "4.0.0"). Retorna negativo, zero ou positivo.
 */
export function compareVersions(a: string, b: string): number {
  const [coreA, preA] = split(a)
  const [coreB, preB] = split(b)
  const length = Math.max(coreA.length, coreB.length)
  for (let i = 0; i < length; i++) {
    const diff = (coreA[i] ?? 0) - (coreB[i] ?? 0)
    if (diff !== 0) return diff
  }
  if (preA && !preB) return -1
  if (!preA && preB) return 1
  return 0
}

function split(version: string): [number[], boolean] {
  const [core, ...rest] = version.split(/[-+]/)
  const numbers = core.split('.').map((n) => Number.parseInt(n, 10) || 0)
  // "4.0.0.RELEASE" é final; "4.0.0-M1", "4.0.0-RC1" e "-SNAPSHOT" são pré-release
  const pre = rest.length > 0 || /\.(M|RC)\d+$/i.test(core)
  return [numbers, pre]
}

/** BOOT_VERSION, JAVA_BASELINE e GRADLE_VERSION a partir das versões detectadas. */
export function checkVersions(project: ProjectInfo): Finding[] {
  const findings: Finding[] = []

  for (const ref of project.boot) {
    if (compareVersions(ref.value, BASELINE.boot) < 0) {
      findings.push({
        ruleId: 'BOOT_VERSION',
        severity: 'warning',
        file: ref.file,
        line: ref.line,
        message: `Spring Boot ${ref.value}: o caminho recomendado é passar pelo último 3.5.x antes do 4.0`,
        fix: 'Suba para o último 3.5.x, resolva as depreciações e então vá para o 4.0',
        docs: MIGRATION_GUIDE
      })
    } else if (compareVersions(ref.value, BASELINE.target) < 0) {
      findings.push({
        ruleId: 'BOOT_VERSION',
        severity: 'info',
        file: ref.file,
        line: ref.line,
        message: `Spring Boot ${ref.value}: pronto para começar a migração para o 4.0`,
        fix: 'Resolva os outros achados e atualize a versão para 4.0.x',
        docs: MIGRATION_GUIDE
      })
    }
  }

  for (const ref of project.java) {
    if (compareVersions(ref.value, BASELINE.java) < 0) {
      findings.push({
        ruleId: 'JAVA_BASELINE',
        severity: 'error',
        file: ref.file,
        line: ref.line,
        message: `Java ${ref.value}: o Spring Boot 4 exige Java 17 ou mais recente`,
        fix: 'Use Java 17+ (recomendado: a LTS mais recente)',
        docs: SYSTEM_REQUIREMENTS
      })
    }
  }

  for (const ref of project.gradle) {
    if (compareVersions(ref.value, BASELINE.gradle) < 0) {
      findings.push({
        ruleId: 'GRADLE_VERSION',
        severity: 'error',
        file: ref.file,
        line: ref.line,
        message: `Gradle ${ref.value}: o plugin do Spring Boot 4 exige Gradle 8.14 ou mais recente`,
        fix: 'Rode ./gradlew wrapper --gradle-version 8.14.3 (ou uma 9.x)',
        docs: SYSTEM_REQUIREMENTS
      })
    }
  }

  return findings
}
