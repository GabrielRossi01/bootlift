import type { Analysis } from '../analyze.js'
import type { FailOn, Finding, Mode, Severity, VersionRef } from '../types.js'

/** Marcador invisível que identifica o comentário do Bootlift no PR. */
export const MARKER = '<!-- bootlift -->'

/** Linhas por tabela; o resto vira "… e mais N". Mantém o comentário curto. */
export const MAX_ROWS = 40

const ICON: Record<Severity, string> = {
  error: '🔴',
  warning: '🟡',
  info: '🔵'
}

export interface ReportInput {
  analysis: Analysis
  /** Achados que podem reprovar o job no modo atual. */
  blocking: Finding[]
  mode: Mode
  /** true quando o relatório é sobre um PR (guardrail de fato aplicado). */
  pullRequest: boolean
  failOn: FailOn
  /** Gera o link para arquivo/linha no GitHub; sem ele, o local sai como texto. */
  link?: (finding: Finding) => string | undefined
}

/** Relatório em Markdown: usado no comentário do PR e no job summary. */
export function renderReport(input: ReportInput): string {
  const { analysis, blocking, mode, pullRequest, failOn } = input
  const { findings, score, project } = analysis
  const guardrail = mode === 'guardrail' && pullRequest
  const out: string[] = [MARKER]

  out.push(`## 🚀 Bootlift — Spring Boot 4 Readiness: **${score}/100**`, '')
  out.push(`\`${scoreBar(score)}\``, '')

  if (findings.length === 0) {
    out.push(
      '✅ Nenhum problema encontrado. Este projeto está pronto para o Spring Boot 4!',
      ''
    )
  } else if (guardrail) {
    out.push(
      blocking.length === 0
        ? `🛡️ **Modo guardrail:** este PR não adiciona nenhum problema novo. Há ${plural(findings.length, 'achado')} no repositório, que só contam no score.`
        : `🛡️ **Modo guardrail:** este PR adiciona ${plural(blocking.length, 'problema novo', 'problemas novos')}. Há ${plural(findings.length, 'achado')} no repositório; só os novos podem reprovar o job.`,
      ''
    )
  } else {
    out.push(
      `🔎 **Modo full:** ${plural(findings.length, 'achado')} no repositório.`,
      ''
    )
  }

  out.push(
    '| Spring Boot | Java | Gradle | Build |',
    '| --- | --- | --- | --- |',
    `| ${versions(project.boot)} | ${versions(project.java)} | ${versions(project.gradle)} | ${project.buildTools.join(', ') || '—'} |`,
    ''
  )

  if (findings.length > 0) {
    if (guardrail) {
      if (blocking.length > 0) {
        out.push('### Novos neste PR', '', ...table(blocking, input.link), '')
      }
      const legacy = findings.filter((f) => !blocking.includes(f))
      if (legacy.length > 0) {
        out.push(
          '<details>',
          `<summary>Já existentes no repositório (${legacy.length}) — não bloqueiam este PR</summary>`,
          '',
          ...table(legacy, input.link),
          '',
          '</details>',
          ''
        )
      }
    } else {
      out.push('### Achados', '', ...table(findings, input.link), '')
    }
  }

  out.push(
    `<sub>fail-on: \`${failOn}\` · score: cada regra tira 15 (error), 5 (warning) ou 1 (info), +1 por ocorrência extra · ` +
      '[Bootlift](https://github.com/GabrielRossi01/bootlift) · regras baseadas no ' +
      '[guia oficial de migração](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)</sub>'
  )
  return out.join('\n')
}

function table(findings: Finding[], link?: ReportInput['link']): string[] {
  const rows = findings.slice(0, MAX_ROWS).map((f) => {
    const where = `${f.file}:${f.line}`
    const url = link?.(f)
    const location = url
      ? `[\`${escape(where)}\`](${url})`
      : `\`${escape(where)}\``
    const fix = f.docs ? `${escape(f.fix)} ([guia](${f.docs}))` : escape(f.fix)
    return `| ${ICON[f.severity]} | \`${f.ruleId}\` | ${location} | ${escape(f.message)} | ${fix} |`
  })
  const rest = findings.length - rows.length
  return [
    '| | Regra | Local | Problema | Como corrigir |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    ...(rest > 0 ? [`| | | | … e mais ${rest} | |`] : [])
  ]
}

function versions(refs: VersionRef[]): string {
  const unique = [...new Set(refs.map((r) => r.value))]
  return unique.length ? unique.join(', ') : '—'
}

/** ▰▰▰▰▰▰▰▱▱▱ para 70/100. */
export function scoreBar(score: number): string {
  const full = Math.round(score / 10)
  return '▰'.repeat(full) + '▱'.repeat(10 - full)
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Evita que | ou quebras de linha quebrem a tabela do Markdown. */
function escape(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}
