const knowledgeFooter = /\s*以上内容来自景区知识档案[，,]你还可以继续询问更具体的问题[。.]?\s*$/

export function formatTourMessage(message: string, guideReply = false, names: string[] = []) {
  let content = message || ''
  if (guideReply) {
    content = content.replace(knowledgeFooter, '')
    for (const name of names.filter(Boolean)) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      content = content.replace(new RegExp(`(^|\\n)\\s*${escaped}(?:先生|女士|老师|小朋友)?\\s*[，,：:、]\\s*`, 'gm'), '$1')
    }
  }
  return content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
}
