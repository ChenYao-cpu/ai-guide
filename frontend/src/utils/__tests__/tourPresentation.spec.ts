import { describe, expect, it } from 'vitest'
import { formatTourMessage } from '../tourPresentation'

describe('tour message presentation', () => {
  it('removes only the repeated footer while retaining the factual answer', () => {
    expect(formatTourMessage('请以现场公告为准。\n以上内容来自景区知识档案，你还可以继续询问更具体的问题。', true)).toBe('请以现场公告为准。')
  })
  it('keeps visitor text and references that are part of the answer', () => {
    const text = '以上内容来自景区知识档案，你还可以继续询问更具体的问题。'
    expect(formatTourMessage(text)).toBe(text)
    expect(formatTourMessage('资料来自景区知识档案。长廊全长728米。', true)).toBe('资料来自景区知识档案。长廊全长728米。')
  })
  it('escapes executable HTML while retaining supported emphasis and line breaks', () => {
    expect(formatTourMessage('<img src=x onerror=alert(1)>\n**长廊** & 湖面')).toBe('&lt;img src=x onerror=alert(1)&gt;<br/><strong>长廊</strong> &amp; 湖面')
  })
  it('removes repeated greetings using literal names, without changing factual names', () => {
    expect(formatTourMessage('小[林]，您好\n小[林]老师：看看长廊', true, ['小[林]'])).toBe('您好<br/>看看长廊')
    expect(formatTourMessage('文轩建议去长廊。', true, ['文轩'])).toBe('文轩建议去长廊。')
  })
})
