import type { Octokit } from './diff.js'
import { MARKER } from './markdown.js'

export interface IssueRef {
  owner: string
  repo: string
  issue_number: number
}

/**
 * Cria o comentário do Bootlift no PR ou atualiza o que já existe.
 *
 * O marcador HTML invisível (<!-- bootlift -->) identifica o comentário, então
 * cada push edita o mesmo comentário em vez de empilhar um novo.
 */
export async function upsertComment(
  octokit: Octokit,
  issue: IssueRef,
  body: string
): Promise<'created' | 'updated'> {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    ...issue,
    per_page: 100
  })
  const existing = comments.find((c) => c.body?.includes(MARKER))
  const { owner, repo } = issue

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body
    })
    return 'updated'
  }
  await octokit.rest.issues.createComment({ ...issue, body })
  return 'created'
}
