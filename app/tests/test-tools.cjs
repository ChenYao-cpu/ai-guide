const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '..')
function dependency(name) {
  try { return require(name) }
  catch (_) { return createRequire(path.resolve(root, '../frontend/package.json'))(name) }
}
function translator() {
  const context = { webEnglish: require('../common/web-en.json'), additionalEnglish: require('../common/en.json') }
  vm.createContext(context)
  const code = fs.readFileSync(path.join(root, 'common/tour-language.js'), 'utf8').replace(/^import .*$/gm, '').replace(/export /g, '')
  vm.runInContext(code + '\nthis.translate = translateTour', context)
  return context.translate
}
function vueFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? vueFiles(path.join(dir, entry.name)) : entry.name.endsWith('.vue') ? [path.join(dir, entry.name)] : [])
}
module.exports = { root, dependency, translator, vueFiles }
