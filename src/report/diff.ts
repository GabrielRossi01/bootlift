import type * as github from '@actions/github'

export type Octokit = ReturnType<typeof github.getOctokit>

export interface PullRef {
  owner: string
  repo: string
  pull_number: number
}

/**
 * Números das linhas ADICIONADAS por um patch unificado (lado "novo" do diff).
 *
 *   @@ -10,4 +10,5 @@   → a contagem do lado novo começa na linha 10
 *   " linha"            → contexto: avança a contagem
 *   "+linha"            → adicionada: registra e avança
 *   "-linha"            → removida: não existe no arquivo novo, não avança
 */
export function parsePatch(patch: string): Set<number> {
  const added = new Set<number>()
  let line = 0
  for (const row of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row)
    if (hunk) {
      line = Number(hunk[1])
    } else if (row.startsWith('+')) {
      added.add(line++)
    } else if (row.startsWith(' ')) {
      line++
    }
  }
  return added
}

/**
 * Arquivo → linhas adicionadas no pull request.
 *
 * O GitHub omite o `patch` de arquivos muito grandes ou binários; esses
 * arquivos ficam de fora (nenhuma linha deles bloqueia o PR).
 */
export async function addedLines(
  octokit: Octokit,
  pull: PullRef
): Promise<Map<string, Set<number>>> {
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    ...pull,
    per_page: 100
  })
  const added = new Map<string, Set<number>>()
  for (const file of files) {
    if (file.patch) added.set(file.filename, parsePatch(file.patch))
  }
  return added
}
