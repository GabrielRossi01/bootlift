import type { BuildTool, ProjectInfo, SourceFile, VersionRef } from './types.js'

/**
 * Descobre as versões de Spring Boot, Java e Gradle declaradas no projeto.
 *
 * Cada versão volta com arquivo e linha, porque as regras do Dia 3 vão apontar
 * exatamente onde mudar. Projetos multi-módulo podem ter várias ocorrências;
 * todas são devolvidas.
 */
export function detectProject(files: SourceFile[]): ProjectInfo {
  const info: ProjectInfo = { buildTools: [], boot: [], java: [], gradle: [] }
  const tools = new Set<BuildTool>()

  for (const file of files) {
    if (file.scope !== 'build') continue
    const name = file.path.split('/').pop() ?? ''
    if (name === 'pom.xml') {
      tools.add('maven')
      readMaven(file, info)
    } else if (name === 'build.gradle' || name === 'build.gradle.kts') {
      tools.add('gradle')
      readGradleBuild(file, info)
    } else if (name.endsWith('.versions.toml')) {
      readVersionCatalog(file, info)
    } else if (name === 'gradle.properties') {
      readGradleProperties(file, info)
    } else if (name === 'gradle-wrapper.properties') {
      readGradleWrapper(file, info)
    }
  }

  info.buildTools = [...tools].sort()
  info.boot = dedupe(info.boot)
  info.java = dedupe(info.java)
  info.gradle = dedupe(info.gradle)
  return info
}

// ---------------------------------------------------------------- Maven

function readMaven(file: SourceFile, info: ProjectInfo): void {
  const xml = mask(file.content, /<!--[\s\S]*?-->/g)
  const props = mavenProperties(xml)

  const parent = /<parent>[\s\S]*?<\/parent>/.exec(xml)
  if (
    parent &&
    /<artifactId>\s*spring-boot-starter-parent\s*</.test(parent[0])
  ) {
    addTag(file, xml, parent, 'version', props, info.boot, 'maven-parent')
  }

  for (const dep of xml.matchAll(/<dependency>[\s\S]*?<\/dependency>/g)) {
    if (/<artifactId>\s*spring-boot-dependencies\s*</.test(dep[0])) {
      addTag(file, xml, dep, 'version', props, info.boot, 'maven-bom')
    }
  }

  for (const name of ['java.version', 'maven.compiler.release']) {
    const prop = props.get(name)
    if (prop)
      push(info.java, prop.value, file, prop.line, `maven-${name}`, true)
  }
  for (const m of xml.matchAll(/<release>\s*([^<\s]+)\s*<\/release>/g)) {
    const resolved = resolve(m[1], props, lineAt(xml, m.index))
    if (resolved) {
      push(
        info.java,
        resolved.value,
        file,
        resolved.line,
        'maven-compiler-release',
        true
      )
    }
  }
}

interface Located {
  value: string
  line: number
}

function mavenProperties(xml: string): Map<string, Located> {
  const props = new Map<string, Located>()
  const block = /<properties>([\s\S]*?)<\/properties>/.exec(xml)
  if (!block) return props
  const start = block.index + '<properties>'.length
  for (const m of block[1].matchAll(/<([\w.-]+)>\s*([^<]*?)\s*<\/\1>/g)) {
    props.set(m[1], { value: m[2], line: lineAt(xml, start + m.index) })
  }
  return props
}

/** Lê `<tag>valor</tag>` dentro de um bloco, resolvendo `${propriedade}`. */
function addTag(
  file: SourceFile,
  xml: string,
  block: RegExpExecArray | RegExpMatchArray,
  tag: string,
  props: Map<string, Located>,
  target: VersionRef[],
  source: string
): void {
  const m = new RegExp(`<${tag}>\\s*([^<\\s]+)\\s*</${tag}>`).exec(block[0])
  if (!m) return
  const line = lineAt(xml, (block.index ?? 0) + m.index)
  const resolved = resolve(m[1], props, line)
  if (resolved) push(target, resolved.value, file, resolved.line, source)
}

/** `${x}` vira o valor da propriedade x, apontando para a linha dela. */
function resolve(
  raw: string,
  props: Map<string, Located>,
  line: number
): Located | undefined {
  const ref = /^\$\{([\w.-]+)\}$/.exec(raw)
  if (!ref) return { value: raw, line }
  return props.get(ref[1])
}

// ---------------------------------------------------------------- Gradle

const BOOT_PLUGIN =
  /\bid\s*\(?\s*["']org\.springframework\.boot["']\s*\)?\s*version\s*\(?\s*["']([^"']+)["']/g
const BOOT_COORDS =
  /org\.springframework\.boot:spring-boot-(?:gradle-plugin|dependencies):(\d[\w.-]*)/g
const TOOLCHAIN =
  /JavaLanguageVersion\.of\(\s*["']?(\d+)["']?\s*\)|jvmToolchain\(\s*(\d+)\s*\)/g
const COMPATIBILITY =
  /\b(?:source|target)Compatibility\s*=\s*(?:JavaVersion\.VERSION_(\d+(?:_\d+)?)|["']?(\d+(?:\.\d+)?)["']?)/g

function readGradleBuild(file: SourceFile, info: ProjectInfo): void {
  const code = mask(file.content, /\/\*[\s\S]*?\*\//g, /(^|\s)\/\/.*$/gm)
  for (const m of code.matchAll(BOOT_PLUGIN)) {
    push(info.boot, m[1], file, lineAt(code, m.index), 'gradle-plugin')
  }
  for (const m of code.matchAll(BOOT_COORDS)) {
    push(info.boot, m[1], file, lineAt(code, m.index), 'gradle-coordinates')
  }
  for (const m of code.matchAll(TOOLCHAIN)) {
    push(
      info.java,
      m[1] ?? m[2],
      file,
      lineAt(code, m.index),
      'gradle-toolchain',
      true
    )
  }
  for (const m of code.matchAll(COMPATIBILITY)) {
    const value = m[1] ? m[1].replace('_', '.') : m[2]
    push(
      info.java,
      value,
      file,
      lineAt(code, m.index),
      'gradle-compatibility',
      true
    )
  }
}

function readVersionCatalog(file: SourceFile, info: ProjectInfo): void {
  const toml = mask(file.content, /(^|\s)#.*$/gm)
  const versions = new Map<string, Located>()
  let section = ''
  const entries: {
    section: string
    key: string
    body: string
    line: number
  }[] = []

  toml.split('\n').forEach((raw, i) => {
    const text = raw.trim()
    const header = /^\[([\w.-]+)\]$/.exec(text)
    if (header) {
      section = header[1]
      return
    }
    const kv = /^([\w.-]+)\s*=\s*(.+)$/.exec(text)
    if (!kv) return
    if (section === 'versions') {
      const value = /^["']([^"']+)["']$/.exec(kv[2])
      if (value) versions.set(kv[1], { value: value[1], line: i + 1 })
    } else {
      entries.push({ section, key: kv[1], body: kv[2], line: i + 1 })
    }
  })

  for (const e of entries) {
    const isBoot =
      (e.section === 'plugins' &&
        /id\s*=\s*["']org\.springframework\.boot["']/.test(e.body)) ||
      (e.section === 'libraries' &&
        /org\.springframework\.boot:spring-boot-dependencies/.test(e.body))
    if (!isBoot) continue
    const direct = /(?:^|[\s{,])version\s*=\s*["']([^"']+)["']/.exec(e.body)
    const ref = /version\.ref\s*=\s*["']([^"']+)["']/.exec(e.body)
    const found = direct
      ? { value: direct[1], line: e.line }
      : ref
        ? versions.get(ref[1])
        : undefined
    if (found) push(info.boot, found.value, file, found.line, 'version-catalog')
  }
}

function readGradleProperties(file: SourceFile, info: ProjectInfo): void {
  file.content.split('\n').forEach((raw, i) => {
    const m =
      /^\s*spring[-._]?boot[-._]?version\s*[=:]\s*(\d[\w.-]*)\s*$/i.exec(raw)
    if (m) push(info.boot, m[1], file, i + 1, 'gradle-properties')
  })
}

function readGradleWrapper(file: SourceFile, info: ProjectInfo): void {
  const m =
    /^\s*distributionUrl\s*=.*gradle-(\d[\w.-]*?)-(?:bin|all)\.zip/m.exec(
      file.content
    )
  if (m)
    push(
      info.gradle,
      m[1],
      file,
      lineAt(file.content, m.index),
      'gradle-wrapper'
    )
}

// ---------------------------------------------------------------- helpers

/** Troca comentários por espaços, mantendo as quebras de linha (e as posições). */
export function mask(content: string, ...patterns: RegExp[]): string {
  return patterns.reduce(
    (text, pattern) =>
      text.replace(pattern, (match) => match.replace(/[^\n]/g, ' ')),
    content
  )
}

/** Linha 1-based de um índice dentro do texto. */
export function lineAt(content: string, index: number | undefined): number {
  return content.slice(0, index ?? 0).split('\n').length
}

/** Java "1.8" vira "8"; "11.0" vira "11"; o resto passa direto. */
export function normalizeJava(value: string): string {
  const legacy = /^1\.(\d+)$/.exec(value)
  if (legacy) return legacy[1]
  return value.replace(/\.0$/, '')
}

function push(
  target: VersionRef[],
  value: string,
  file: SourceFile,
  line: number,
  source: string,
  java = false
): void {
  if (!/^\d/.test(value)) return // placeholders como $springBootVersion ficam de fora
  target.push({
    value: java ? normalizeJava(value) : value,
    file: file.path,
    line,
    source
  })
}

/** Remove repetições da mesma declaração (ex.: release apontando para java.version). */
function dedupe(refs: VersionRef[]): VersionRef[] {
  const seen = new Set<string>()
  return refs.filter((r) => {
    const key = `${r.file}:${r.line}:${r.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
