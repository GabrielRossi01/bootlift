import type { Finding } from '../types.js'
import type { Octokit } from './diff.js'

/** Marcador invisível das sugestões do Bootlift (evita repetir a cada push). */
export const SUGGESTION_MARKER = '<!-- bootlift:suggestion -->'

/** Um review com centenas de comentários vira ruído; o resto fica no relatório. */
export const MAX_SUGGESTIONS = 20

export interface ReviewRef {
  owner: string
  repo: string
  pull_number: number
  /** SHA do head do PR: prende as sugestões à versão analisada. */
  commit_id?: string
}

export interface ReviewResult {
  /** Sugestões publicadas agora. */
  posted: number
  /** Sugestões que já estavam no PR (de um push anterior) e foram puladas. */
  skipped: number
}

interface ReviewComment {
  path: string
  line: number
  side: 'RIGHT'
  body: string
}

/**
 * Achados que viram sugestão de 1 clique: os que têm correção determinística.
 * Uma sugestão por linha. Se duas regras corrigem a mesma linha, vai a
 * primeira; a outra aparece no próximo push, já sobre a linha corrigida.
 */
export function suggestable(findings: Finding[]): Finding[] {
  const byLine = new Map<string, Finding>()
  for (const f of findings) {
    if (f.suggestion === undefined) continue
    const key = `${f.file}:${f.line}`
    if (!byLine.has(key)) byLine.set(key, f)
  }
  return [...byLine.values()]
}

/** Corpo do comentário: explicação curta + bloco ```suggestion. */
export function suggestionBody(finding: Finding): string {
  const code = finding.suggestion ?? ''
  // Se a linha já tiver ```, a cerca precisa ser maior que qualquer uma dentro.
  const longest = Math.max(
    2,
    ...[...code.matchAll(/`+/g)].map((m) => m[0].length)
  )
  const fence = '`'.repeat(longest + 1)
  const docs = finding.docs ? ` · [guia de migração](${finding.docs})` : ''
  return [
    `**Bootlift · \`${finding.ruleId}\`**: ${finding.message}.`,
    '',
    `${fence}suggestion`,
    code,
    fence,
    '',
    `<sub>${finding.fix}${docs}</sub>`,
    SUGGESTION_MARKER
  ].join('\n')
}

/**
 * Publica as correções como um review no PR, com um comentário de sugestão em
 * cada linha. O autor aceita uma a uma ("Commit suggestion") ou todas de uma
 * vez ("Add suggestion to batch").
 *
 * Só recebe achados em linhas ADICIONADAS pelo PR (o GitHub não aceita
 * comentário fora do diff). Sugestões iguais já publicadas em pushes
 * anteriores são puladas, então o PR não enche de comentários repetidos.
 */
export async function postSuggestions(
  octokit: Octokit,
  ref: ReviewRef,
  findings: Finding[]
): Promise<ReviewResult> {
  const candidates = suggestable(findings)
  if (candidates.length === 0) return { posted: 0, skipped: 0 }

  const { owner, repo, pull_number } = ref
  const existing = await octokit.paginate(
    octokit.rest.pulls.listReviewComments,
    { owner, repo, pull_number, per_page: 100 }
  )
  const already = new Set(
    existing
      .filter((c) => c.body?.includes(SUGGESTION_MARKER))
      .map((c) => `${c.path}\n${c.body}`)
  )

  const fresh: ReviewComment[] = []
  for (const f of candidates) {
    const body = suggestionBody(f)
    if (already.has(`${f.file}\n${body}`)) continue
    fresh.push({ path: f.file, line: f.line, side: 'RIGHT', body })
  }
  const skipped = candidates.length - fresh.length
  if (fresh.length === 0) return { posted: 0, skipped }

  const comments = fresh.slice(0, MAX_SUGGESTIONS)
  const rest = fresh.length - comments.length
  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number,
    ...(ref.commit_id ? { commit_id: ref.commit_id } : {}),
    event: 'COMMENT',
    body: reviewBody(comments.length, rest),
    comments
  })
  return { posted: comments.length, skipped }
}

function reviewBody(count: number, rest: number): string {
  const what =
    count === 1
      ? '1 correção pronta para aplicar em 1 clique'
      : `${count} correções prontas para aplicar em 1 clique`
  const more =
    rest > 0
      ? ` Mais ${rest} aparecem no próximo push, depois que estas forem aplicadas.`
      : ''
  return (
    `🚀 **Bootlift:** ${what}. Use **Commit suggestion** em cada uma ou ` +
    `**Add suggestion to batch** para juntar todas num commit só.${more}`
  )
}
