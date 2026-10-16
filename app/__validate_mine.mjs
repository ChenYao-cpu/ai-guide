// 临时校验：检查 mine.vue 的 script 语法 + template 标签闭合 + 关键绑定是否存在
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = path.dirname(fileURLToPath(import.meta.url))
const file = path.resolve(here, 'pages/mine/mine.vue')
const src = fs.readFileSync(file, 'utf8')

const grab = (tag) => {
  const m = src.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>'))
  return m ? m[1] : null
}
const script = grab('script')
const template = grab('template')
const style = grab('style')
if (!script || !template || !style) { console.log('!! 缺少 script/template/style 块'); process.exit(1) }

// 1. script 语法检查（转成 ESM 交给 node --check）
const tmp = path.join(process.env.TEMP || '.', `mine-script-${Date.now()}.mjs`)
fs.writeFileSync(tmp, script, 'utf8')
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' })
  console.log('OK  script 语法正确')
} catch (e) {
  console.log('!!  script 语法错误:\n' + (e.stderr ? e.stderr.toString() : e.message))
  process.exitCode = 1
} finally { fs.unlinkSync(tmp) }

// 2. template 标签闭合检查（忽略自闭合与 void 标签）
const voidTags = new Set(['image', 'input', 'br', 'hr', 'img', 'meta', 'link'])
const stack = []
const tagRe = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g
let m, errors = 0
while ((m = tagRe.exec(template))) {
  const [, closing, name, , selfClose] = m
  if (voidTags.has(name) || selfClose) continue
  if (closing) {
    const top = stack.pop()
    if (top !== name) { console.log(`!!  标签不匹配: </${name}> 对应 <${top}>`); errors++ }
  } else stack.push(name)
}
if (stack.length) { console.log('!!  未闭合标签: ' + stack.join(', ')); errors++ }
if (!errors) console.log('OK  template 标签全部正确闭合')

// 3. 关键绑定与定义是否配套
const checks = [
  ['t(', 'template 使用 t()'],
  ['setTourLanguage(', 'template 使用 setTourLanguage()'],
]
for (const [needle, label] of checks) {
  const inTpl = template.includes(needle.replace('(', '('))
  const inScript = script.includes(needle.replace('(', '('))
  console.log(`${inTpl && inScript ? 'OK ' : '!! '} ${label}: template=${inTpl} script=${inScript}`)
  if (!(inTpl && inScript)) process.exitCode = 1
}
const tDef = /t:\s*function/.test(script)
const sDef = /setTourLanguage:\s*function/.test(script)
console.log(`${tDef ? 'OK ' : '!! '} methods 中定义了 t: function`)
console.log(`${sDef ? 'OK ' : '!! '} methods 中定义了 setTourLanguage: function`)
if (!tDef || !sDef) process.exitCode = 1

// 4. 语言切换条样式是否存在
for (const cls of ['.lang-switch', '.lang-btn', '.lang-btn.active']) {
  console.log(`${style.includes(cls) ? 'OK ' : '!! '} 样式存在: ${cls}`)
  if (!style.includes(cls)) process.exitCode = 1
}
console.log(errors === 0 && !process.exitCode ? '\n全部校验通过' : '\n存在问题')
