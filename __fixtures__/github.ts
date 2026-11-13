/**
 * Dublê do @actions/github para os testes.
 *
 * `context` é mutável (cada teste monta o evento que precisa) e `getOctokit`
 * devolve a API falsa criada por `fakeOctokit`.
 */
import { jest } from '@jest/globals'

export const context = {
  repo: { owner: 'GabrielRossi01', repo: 'bootlift' },
  sha: 'cafebabe',
  serverUrl: 'https://github.com',
  payload: {} as Record<string, unknown>
}

interface Comment {
  id: number
  body?: string
}

/** API falsa: arquivos do PR, comentários existentes e o que foi gravado. */
export function fakeOctokit(options: {
  files?: { filename: string; patch?: string }[]
  comments?: Comment[]
  failComments?: boolean
}) {
  const calls = { created: [] as string[], updated: [] as Comment[] }
  const failIfNeeded = () => {
    if (options.failComments)
      throw new Error('Resource not accessible by integration')
  }
  const octokit = {
    rest: {
      pulls: {
        listFiles: jest.fn(async () => ({ data: options.files ?? [] }))
      },
      issues: {
        listComments: jest.fn(async () => {
          failIfNeeded()
          return { data: options.comments ?? [] }
        }),
        createComment: jest.fn(async ({ body }: { body: string }) => {
          calls.created.push(body)
          return { data: { id: 99 } }
        }),
        updateComment: jest.fn(
          async ({
            comment_id,
            body
          }: {
            comment_id: number
            body: string
          }) => {
            calls.updated.push({ id: comment_id, body })
            return { data: { id: comment_id } }
          }
        )
      }
    },
    paginate: jest.fn(
      async (
        method: (params: unknown) => Promise<{ data: unknown[] }>,
        params: unknown
      ) => {
        const { data } = await method(params)
        return data
      }
    )
  }
  return { octokit, calls }
}

export const getOctokit = jest.fn()
