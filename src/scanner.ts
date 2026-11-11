import { lstat, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Scope, SourceFile } from './types.js'

/**
 * Pastas que nunca têm código do usuário. São puladas em qualquer nível, sem
 * entrar nelas (é isso que mantém o scan rápido em monorepos grandes).
 */
const ALWAYS_SKIP = new Set(['node_modules'])

/**
 * Pastas de saída de build. Só são puladas FORA de `src/`: um pacote Java
 * chamado `build` (src/main/java/com/acme/build) continua sendo lido.
 */
const OUTPUT_DIRS = new Set(['target', 'build', 'out', 'bin'])

/** Arquivos maiores que isso costumam ser gerados; não vale a pena ler. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024

const BUILD_FILES = new Set([
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'gradle.properties',
  'gradle-wrapper.properties'
])

/** Descobre o escopo de um arquivo pelo nome, ou `undefined` se não interessa. */
export function classify(fileName: string): Scope | undefined {
  if (BUILD_FILES.has(fileName) || fileName.endsWith('.versions.toml')) {
    return 'build'
  }
  if (
    /^(application|bootstrap)([-.][\w.-]*)?\.(properties|ya?ml)$/.test(fileName)
  ) {
    return 'config'
  }
  if (fileName.endsWith('.java') || fileName.endsWith('.kt')) return 'java'
  return undefined
}

/** Decide se o scanner deve entrar numa pasta. */
export function shouldEnter(dirName: string, insideSrc: boolean): boolean {
  if (dirName.startsWith('.')) return false // .git, .gradle, .idea, .mvn...
  if (ALWAYS_SKIP.has(dirName)) return false
  if (!insideSrc && OUTPUT_DIRS.has(dirName)) return false
  return true
}

/**
 * Percorre `root` e devolve os arquivos relevantes, ordenados pelo caminho.
 *
 * @param root      pasta do projeto (input `path` já resolvido)
 * @param workspace raiz do repositório; os caminhos saem relativos a ela, com
 *                  "/", que é o formato que o GitHub usa nas annotations
 */
export async function scan(
  root: string,
  workspace: string
): Promise<SourceFile[]> {
  const files: SourceFile[] = []

  async function walk(dir: string, insideSrc: boolean): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isSymbolicLink()) continue // evita loops e arquivos fora do repo
      if (entry.isDirectory()) {
        if (shouldEnter(entry.name, insideSrc)) {
          await walk(full, insideSrc || entry.name === 'src')
        }
        continue
      }
      const scope = entry.isFile() ? classify(entry.name) : undefined
      if (!scope) continue
      const { size } = await lstat(full)
      if (size > MAX_FILE_BYTES) continue
      files.push({
        scope,
        path: toPosix(path.relative(workspace, full)),
        content: await readFile(full, 'utf8')
      })
    }
  }

  await walk(root, false)
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

/** Quantos arquivos de cada escopo foram lidos. */
export function countByScope(files: SourceFile[]): Record<Scope, number> {
  const counts: Record<Scope, number> = { java: 0, build: 0, config: 0 }
  for (const file of files) counts[file.scope]++
  return counts
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}
