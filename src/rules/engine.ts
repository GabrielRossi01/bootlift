import { mask } from '../project.js'
import type { FailOn, Finding, Rule, Severity, SourceFile } from '../types.js'
import { RULES } from './catalog.js'

/** Peso de cada severidade no score (100 − soma dos pesos, mínimo 0). */
export const WEIGHT: Record<Severity, number> = {
  error: 15,
  warning: 5,
  info: 1
}

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2
}

/**
 * Aplica as regras de linha a cada arquivo do escopo correspondente.
 *
 * - Linhas de comentário são ignoradas (`//`, `/*`, `*`, `#`, `<!-- -->`).
 * - Uma regra gera no máximo um achado por linha.
 * - Com `replace`, o achado traz a linha corrigida em `suggestion`.
 */
export function runRules(
  files: SourceFile[],
  rules: readonly Rule[] = RULES
): Finding[] {
  const compiled = rules.map((rule) => ({ rule, re: new RegExp(rule.pattern) }))
  const findings: Finding[] = []

  for (const file of files) {
    const original = file.content.split(/\r?\n/)
    const scannable = scannableLines(file)
    const seen = new Set<string>()

    for (const { rule, re } of compiled) {
      if (rule.scope !== file.scope) continue
      scannable.forEach((text, i) => {
        if (!text || !re.test(text)) return
        const key = `${rule.id}:${i}`
        if (seen.has(key)) return
        seen.add(key)
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          file: file.path,
          line: i + 1,
          message: rule.message,
          fix: rule.fix,
          docs: rule.docs,
          suggestion:
            rule.replace === undefined
              ? undefined
              : original[i].replace(re, rule.replace)
        })
      })
    }
  }
  return findings
}

/** Linhas do arquivo com os comentários trocados por linha vazia. */
function scannableLines(file: SourceFile): string[] {
  const name = file.path.split('/').pop() ?? ''
  const text = name.endsWith('.xml')
    ? mask(file.content, /<!--[\s\S]*?-->/g)
    : file.content
  const hashComments = /\.(properties|toml)$/.test(name)
  return text.split(/\r?\n/).map((line) => {
    const t = line.trimStart()
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return ''
    if (hashComments && (t.startsWith('#') || t.startsWith('!'))) return ''
    return line
  })
}

/** Pontos extras perdidos por ocorrência repetida da mesma regra, e o teto. */
export const EXTRA_PER_OCCURRENCE = 1
export const MAX_EXTRA_PER_RULE = 10

/**
 * Score de 0 a 100. Cada regra encontrada pesa uma vez pela severidade
 * (error 15, warning 5, info 1) e cada ocorrência a mais tira 1 ponto, até 10
 * por regra. Assim o score mede quantos TIPOS de problema existem: 30 imports
 * javax.* não zeram a nota sozinhos.
 */
export function computeScore(findings: Finding[]): number {
  const byRule = new Map<string, { weight: number; count: number }>()
  for (const f of findings) {
    const entry = byRule.get(f.ruleId) ?? { weight: 0, count: 0 }
    entry.weight = Math.max(entry.weight, WEIGHT[f.severity])
    entry.count++
    byRule.set(f.ruleId, entry)
  }
  let penalty = 0
  for (const { weight, count } of byRule.values()) {
    penalty +=
      weight + Math.min((count - 1) * EXTRA_PER_OCCURRENCE, MAX_EXTRA_PER_RULE)
  }
  return Math.max(0, 100 - penalty)
}

/** true quando algum achado tem severidade igual ou acima de `failOn`. */
export function shouldFail(findings: Finding[], failOn: FailOn): boolean {
  if (failOn === 'none') return false
  if (failOn === 'warning') return findings.some((f) => f.severity !== 'info')
  return findings.some((f) => f.severity === 'error')
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 }
  for (const f of findings) counts[f.severity]++
  return counts
}

/** Ordena por severidade, arquivo e linha (ordem estável para relatório e testes). */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
      a.line - b.line ||
      (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0)
  )
}
