import { detectProject } from './project.js'
import {
  computeScore,
  countBySeverity,
  runRules,
  sortFindings
} from './rules/engine.js'
import { checkProperties } from './rules/properties.js'
import { checkVersions } from './rules/versions.js'
import type { Finding, ProjectInfo, Severity, SourceFile } from './types.js'

export interface Analysis {
  project: ProjectInfo
  /** Todos os achados do repositório, ordenados por severidade, arquivo e linha. */
  findings: Finding[]
  /** Nota de 0 a 100 do repositório inteiro. */
  score: number
  counts: Record<Severity, number>
}

/** Junta as três famílias de regras sobre os arquivos lidos pelo scanner. */
export function analyze(files: SourceFile[]): Analysis {
  const project = detectProject(files)
  const findings = sortFindings([
    ...runRules(files),
    ...checkVersions(project),
    ...checkProperties(files)
  ])
  return {
    project,
    findings,
    score: computeScore(findings),
    counts: countBySeverity(findings)
  }
}
