import type { Finding, SourceFile } from '../types.js'
import { MIGRATION_GUIDE } from './catalog.js'
import { RENAMED_PROPERTIES } from './renamed-properties.js'

/** Uma chave de configuração e a linha em que ela termina de ser declarada. */
export interface PropertyKey {
  key: string
  line: number
}

/** Chaves de um .properties (`a.b=c`, `a.b: c` ou `a.b c`). */
export function flattenProperties(content: string): PropertyKey[] {
  const keys: PropertyKey[] = []
  let continued = false
  content.split(/\r?\n/).forEach((raw, i) => {
    const wasContinued = continued
    continued = /(^|[^\\])(\\\\)*\\$/.test(raw)
    if (wasContinued) return
    const line = raw.trimStart()
    if (!line || line.startsWith('#') || line.startsWith('!')) return
    const m = /^((?:\\.|[^=:\s\\])+)/.exec(line)
    if (m) keys.push({ key: m[1].replace(/\\(.)/g, '$1'), line: i + 1 })
  })
  return keys
}

/**
 * Chaves de um YAML, já "achatadas" (spring > data > mongodb > uri vira
 * spring.data.mongodb.uri). Cobre o que aparece em application.yml: mapas
 * aninhados, chaves com ponto, vários documentos (---) e blocos `|`/`>`.
 * Itens de lista são ignorados.
 */
export function flattenYaml(content: string): PropertyKey[] {
  const keys: PropertyKey[] = []
  let stack: { indent: number; key: string }[] = []
  let blockIndent = -1

  content.split(/\r?\n/).forEach((raw, i) => {
    const indent = raw.length - raw.trimStart().length
    const text = raw.trim()
    if (blockIndent >= 0) {
      if (!text || indent > blockIndent) return
      blockIndent = -1
    }
    if (!text || text.startsWith('#')) return
    if (text === '---' || text === '...') {
      stack = []
      return
    }
    if (text.startsWith('-')) return

    const m = /^(["']?)([^"'#]+?)\1\s*:(?:\s+(.*))?$/.exec(text)
    if (!m) return
    const key = m[2].trim()
    const value = (m[3] ?? '').replace(/(^|\s)#.*$/, '').trim()

    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    const full = [...stack.map((s) => s.key), key].join('.')

    if (value === '') {
      stack.push({ indent, key })
    } else {
      keys.push({ key: full, line: i + 1 })
      if (/^[|>][-+]?\d*$/.test(value)) blockIndent = indent
    }
  })
  return keys
}

/** Forma canônica para comparar (relaxed binding: maiúsculas, - e _ não importam). */
function canonical(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '')
}

const RENAMES = RENAMED_PROPERTIES.map(([from, to]) => ({
  from,
  to,
  canonical: canonical(from)
}))

/** Devolve o nome novo de uma chave renomeada no Boot 4, ou undefined. */
export function renamedKey(key: string): string | undefined {
  const c = canonical(key)
  for (const r of RENAMES) {
    if (c === r.canonical) return r.to
    if (c.startsWith(`${r.canonical}.`)) {
      // mantém o sufixo como o usuário escreveu: spring.jackson.read.X → spring.jackson.json.read.X
      const depth = r.from.split('.').length
      return [r.to, ...key.split('.').slice(depth)].join('.')
    }
  }
  return undefined
}

/** PROPERTY_RENAMED em application*.properties / application*.yml. */
export function checkProperties(files: SourceFile[]): Finding[] {
  const findings: Finding[] = []
  for (const file of files) {
    if (file.scope !== 'config') continue
    const yaml = /\.ya?ml$/.test(file.path)
    const keys = yaml
      ? flattenYaml(file.content)
      : flattenProperties(file.content)
    const lines = file.content.split(/\r?\n/)

    for (const { key, line } of keys) {
      const to = renamedKey(key)
      if (!to) continue
      const original = lines[line - 1]
      // Só dá para sugerir quando a chave inteira está escrita na linha
      // (sempre em .properties; em YAML, só com chave "achatada").
      const suggestion = original.includes(key)
        ? original.replace(key, to)
        : undefined
      findings.push({
        ruleId: 'PROPERTY_RENAMED',
        severity: 'warning',
        file: file.path,
        line,
        message: `A propriedade ${key} foi renomeada no Spring Boot 4`,
        fix: `Use ${to}`,
        docs: MIGRATION_GUIDE,
        suggestion
      })
    }
  }
  return findings
}
