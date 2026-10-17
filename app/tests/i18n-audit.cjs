const fs = require('node:fs'), path = require('node:path')
const { root, dependency, translator, vueFiles } = require('./test-tools.cjs')
const { parse } = dependency('@vue/compiler-sfc'), { baseParse } = dependency('@vue/compiler-dom')
const parser = dependency('@babel/parser'), traverse = dependency('@babel/traverse').default
const translate = translator(), han = /[\u3400-\u9fff]/
const failures = []
const keys = new Set()
function checkKey(value, file) {
  if (!han.test(value)) return
  keys.add(value)
  if (han.test(translate(value, 'en'))) failures.push(path.relative(root, file) + ': missing English: ' + value)
}
function checkExpression(source, file) {
  try {
    const ast = parser.parse('(' + source + ')', { sourceType: 'module' })
    traverse(ast, { CallExpression(p) {
      const name = p.node.callee.name
      if (name === 't' || name === '$t') {
        const first = p.get('arguments.0')
        if (first?.isStringLiteral()) checkKey(first.node.value,file)
        else first?.traverse({StringLiteral(child) {checkKey(child.node.value,file)}})
      }
    } })
  } catch (error) { failures.push(path.relative(root, file) + ': invalid expression: ' + source) }
}
const pages = vueFiles(path.join(root, 'pages')), components = vueFiles(path.join(root, 'components'))
for (const file of [...pages, ...components]) {
  // uni-app supports a second renderjs script; Vue's web parser does not.
  const source = fs.readFileSync(file, 'utf8').replace(/<script\b[^>]*\blang="renderjs"[^>]*>[\s\S]*?<\/script>/g, '')
  const { descriptor, errors } = parse(source)
  for (const error of errors) failures.push(path.relative(root, file) + ': ' + error)
  const visit = node => {
    if (node.type === 2 && han.test(node.content) && node.content.trim() !== '中文') failures.push(path.relative(root, file) + ': raw visible Chinese: ' + node.content)
    if (node.type === 5) checkExpression(node.content.content, file)
    for (const prop of node.props || []) {
      if (prop.type === 6 && prop.value && ['placeholder', 'title', 'aria-label', 'cancel-label', 'confirm-label', 'content'].includes(prop.name) && han.test(prop.value.content)) failures.push(path.relative(root, file) + ': untranslated attribute ' + prop.name)
      if (prop.type === 7 && prop.exp && prop.name === 'bind') checkExpression(prop.exp.content, file)
    }
    for (const child of node.children || []) visit(child)
  }
  if (descriptor.template) visit(baseParse(descriptor.template.content))
  if (descriptor.script) {
    const ast = parser.parse(descriptor.script.content, { sourceType: 'module' })
    traverse(ast, {
      ObjectProperty(p) {
        if (['label','desc','recordingText','message','error','previewMessage'].includes(p.node.key?.name) && p.node.value?.type === 'StringLiteral') checkKey(p.node.value.value,file)
      },
      AssignmentExpression(p) {
        if (p.node.left.type==='MemberExpression' && ['error','message','voiceError','recognitionError','previewMessage','previewModelStatus','registrationMessage','codeNotice','recordingText'].includes(p.node.left.property?.name) && p.node.right.type==='StringLiteral') checkKey(p.node.right.value,file)
      },
      CallExpression(p) {
      if (p.node.callee.type === 'MemberExpression' && p.node.callee.object.name === 'uni' && ['showToast', 'showModal', 'showActionSheet', 'showLoading'].includes(p.node.callee.property.name)) failures.push(path.relative(root, file) + ': native feedback bypasses localization')
      if (!['uiToast', 'uiModal', 'uiActionSheet', 'uiLoading', 'showTourToast'].includes(p.node.callee.name)) return
      for (const arg of p.node.arguments) if (arg.type === 'ObjectExpression') for (const property of arg.properties) {
        if (['title', 'content', 'confirmText', 'cancelText'].includes(property.key?.name) && property.value?.type === 'StringLiteral') checkKey(property.value.value, file)
        if (property.key?.name === 'itemList' && property.value?.type === 'ArrayExpression') for (const item of property.value.elements) if (item?.type === 'StringLiteral') checkKey(item.value, file)
      }
    } })
  }
}
if (failures.length) { console.error([...new Set(failures)].join('\n')); process.exitCode = 1 }
else console.log('All '+pages.length+' App pages and '+components.length+' components pass localization audit (' + keys.size + ' UI keys).')
