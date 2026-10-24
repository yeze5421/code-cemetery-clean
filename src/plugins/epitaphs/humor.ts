import type { EpitaphPlugin, EpitaphStyle, Project } from '../../core/types';
import { formatMonth } from '../../core/dates';

type Line = { epitaph: string; cause: string };
function hash(value: string): number {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

function lines(project: Project, style: EpitaphStyle): Line[] {
  const milestone =
    project.commits === null
      ? '提交记录还没数清'
      : project.commits === 0
        ? '还没等到第一次 commit'
        : `停在第 ${project.commits} 次 commit`;
  const born = `${formatMonth(project.createdAt)} 出生`;
  if (style === 'gentle')
    return [
      { epitaph: `${born}。暂时告别，也算认真开始过。`, cause: '人生有了别的优先级' },
      { epitaph: `${milestone}，但每一行都曾是好奇心的形状。`, cause: '把时间留给了生活' },
      { epitaph: '它没有成为产品，却让一个想法有过容身之处。', cause: '灵感走完了这一程' },
      { epitaph: '那些没有完成的部分，留给未来某个有空的周末。', cause: '暂时按下暂停键' },
      { epitaph: `${born}。谢谢你，陪我学会了一点东西。`, cause: '学习完成，任务结束' },
    ];
  if (style === 'poetic')
    return [
      { epitaph: `${born}，在未写完的函数里，等一场春天。`, cause: '灵感远行，归期未定' },
      { epitaph: `${milestone}。月光替我合上了编辑器。`, cause: '输给了长夜与清晨' },
      { epitaph: '这里埋着一个未来，它曾在终端里亮过。', cause: '星火歇在了半途' },
      { epitaph: '风翻过 README，最后一行仍是 coming soon。', cause: '明天比想象中遥远' },
      { epitaph: '愿未完成的代码，在另一个分支开花。', cause: '在别处重新萌芽' },
    ];
  const few = project.commits !== null && project.commits <= 3;
  return [
    { epitaph: `${born}，${milestone}。想法很多，时间没有。`, cause: '想法太多没时间' },
    {
      epitaph: few
        ? `${milestone}。README 写得比代码长，愿景比宇宙还大。`
        : `${milestone}。本来想改变世界，最后改了文件名。`,
      cause: '宏伟蓝图，微小执行力',
    },
    { epitaph: '最后的遗言：“这个周末一定写完。”', cause: '周末一直在下一个周末' },
    { epitaph: '技术栈换了三轮，核心功能还在 TODO。', cause: '选型太久，热情过期' },
    { epitaph: `${born}。它的竞品已经上市，它还在配置环境。`, cause: '环境配好了，人没电了' },
  ];
}

function englishLines(project: Project, style: EpitaphStyle): Line[] {
  const milestone =
    project.commits === null
      ? 'The commit count is still unknown'
      : project.commits === 0
        ? 'It never reached its first commit'
        : `It stopped at commit ${project.commits}`;
  const born = `Born ${formatMonth(project.createdAt)}`;
  if (style === 'gentle')
    return [
      {
        epitaph: `${born}. A pause does not make the beginning any less real.`,
        cause: 'Life found other priorities',
      },
      {
        epitaph: `${milestone}. Every line was a little act of curiosity.`,
        cause: 'Made room for life',
      },
      {
        epitaph: 'It never became a product, but it gave an idea a place to live.',
        cause: 'This chapter had run its course',
      },
      {
        epitaph: 'The unfinished parts are waiting for a future free weekend.',
        cause: 'Paused for a while',
      },
      {
        epitaph: `${born}. Thank you for teaching me something along the way.`,
        cause: 'The lesson was complete',
      },
    ];
  if (style === 'poetic')
    return [
      {
        epitaph: `${born}. An unfinished function, waiting for spring.`,
        cause: 'Inspiration left without a return date',
      },
      {
        epitaph: `${milestone}. Moonlight closed the editor for me.`,
        cause: 'Lost between late nights and early mornings',
      },
      {
        epitaph: 'Here lies a future that once glowed in a terminal.',
        cause: 'A small spark rested halfway',
      },
      {
        epitaph: 'The wind turns the README. The last line still says coming soon.',
        cause: 'Tomorrow was farther away than it seemed',
      },
      {
        epitaph: 'May this unfinished code bloom on another branch.',
        cause: 'Taking root somewhere else',
      },
    ];
  const few = project.commits !== null && project.commits <= 3;
  return [
    {
      epitaph: `${born}. ${milestone}. Plenty of ideas. No time whatsoever.`,
      cause: 'Too many ideas, not enough hours',
    },
    {
      epitaph: few
        ? `${milestone}. The README was longer than the code. The vision was larger than the universe.`
        : `${milestone}. Meant to change the world. Changed the filename instead.`,
      cause: 'Grand plans, tiny follow-through',
    },
    {
      epitaph: 'Last words: "I will definitely finish it this weekend."',
      cause: 'The weekend was always next weekend',
    },
    {
      epitaph: 'Three tech stacks later, the main feature was still a TODO.',
      cause: 'The enthusiasm expired during research',
    },
    {
      epitaph: `${born}. The competition launched. This one was still setting up the environment.`,
      cause: 'The setup finished. The developer did not.',
    },
  ];
}

export const epitaphGenerator: EpitaphPlugin = {
  id: 'epitaph',
  name: '墓志铭写手',
  version: '1.0.0',
  kind: 'epitaph',
  description:
    '根据项目元数据写趣味墓志铭；“死因”为创作性调侃，不是事实判断。支持幽默、温柔和诗意。',
  generate(project, style, variant = 0, locale = 'zh-CN') {
    const bank = locale === 'en' ? englishLines(project, style) : lines(project, style);
    const offset = Number.isFinite(variant) ? Math.trunc(variant) : 0;
    const index =
      ((((hash(project.id) % bank.length) + offset) % bank.length) + bank.length) % bank.length;
    return { ...bank[index] };
  },
};
