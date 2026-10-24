import type { ExporterPlugin, ExportOptions, Locale, Project } from '../../core/types';
import { localizeProject } from '../../i18n/content';

const WIDTH = 1080;
const MAX_HEIGHT = 30_000;
const MARGIN = 64;
const GAP = 28;
const CARD_WIDTH = (WIDTH - MARGIN * 2 - GAP) / 2;
const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
const SERIF = '"Songti SC", "SimSun", "Microsoft YaHei", serif';
const COLORS = {
  background: '#14221b',
  panel: '#1c2d23',
  paper: '#e9e9d8',
  muted: '#a2b09d',
  moss: '#b2c78e',
  line: '#3b4c3c',
};

/** Dates are interpreted in UTC so a report is stable across machines. */
export function selectExportProjects(options: ExportOptions): Project[] {
  return options.projects
    .filter(
      (project) =>
        project.status === 'buried' &&
        (options.year === 'all' ||
          new Date(project.lastCommitAt).getUTCFullYear() === options.year),
    )
    .slice()
    .sort((a, b) => b.lastCommitAt.localeCompare(a.lastCommitAt) || a.name.localeCompare(b.name));
}

/** A preview estimate. The final canvas uses the exact measured text height. */
export function estimateExportDimensions(projectCount: number): { width: number; height: number } {
  const count = Math.max(0, Math.floor(projectCount));
  return { width: WIDTH, height: 630 + Math.ceil(count / 2) * 450 + 190 };
}

export function formatPosterDate(value: string, locale: Locale = 'zh-CN'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === 'en' ? 'Unknown date' : '日期未知';
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${String(date.getUTCDate()).padStart(2, '0')}`;
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 400, serif = false) {
  ctx.font = `${weight} ${size}px ${serif ? SERIF : FONT}`;
}

/** Keep English words whole; split only oversized tokens at grapheme boundaries. */
export function wrapPosterText(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  width: number,
  locale: Locale = 'zh-CN',
): string[] {
  const lines: string[] = [];
  const segments = new Intl.Segmenter(locale, {
    granularity: locale === 'en' ? 'word' : 'grapheme',
  });
  const graphemes = new Intl.Segmenter(locale, { granularity: 'grapheme' });
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const { segment } of segments.segment(paragraph)) {
      if (line && ctx.measureText(line + segment).width > width) {
        lines.push(line.trimEnd());
        line = '';
      }
      const part = line ? segment : segment.trimStart();
      if (ctx.measureText(part).width <= width) line += part;
      else {
        for (const { segment: glyph } of graphemes.segment(part)) {
          if (line && ctx.measureText(line + glyph).width > width) {
            lines.push(line.trimEnd());
            line = '';
          }
          line += glyph;
        }
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function copy(locale: Locale, chinese: string, english: string): string {
  return locale === 'en' ? english : chinese;
}

function textLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
): number {
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = COLORS.line,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x + size * 0.16, y - size * 0.16, x + size, y);
  ctx.quadraticCurveTo(x + size * 0.16, y + size * 0.16, x, y + size);
  ctx.quadraticCurveTo(x - size * 0.16, y + size * 0.16, x - size, y);
  ctx.quadraticCurveTo(x - size * 0.16, y - size * 0.16, x, y - size);
  ctx.closePath();
  ctx.fillStyle = COLORS.moss;
  ctx.fill();
}

function tombstone(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.moss;
  ctx.beginPath();
  ctx.moveTo(-24, 28);
  ctx.lineTo(-24, -7);
  ctx.arc(0, -7, 24, Math.PI, 0);
  ctx.lineTo(24, 28);
  ctx.closePath();
  ctx.stroke();
  line(ctx, -32, 33, 32, 33, COLORS.moss);
  line(ctx, -8, -7, 8, -7, COLORS.moss);
  line(ctx, 0, -16, 0, 5, COLORS.moss);
  line(ctx, -9, 15, 9, 15, COLORS.moss);
  ctx.restore();
}

interface CardLayout {
  project: Project;
  nameLines: string[];
  metadataLines: string[];
  epitaphLines: string[];
  causeLines: string[];
  height: number;
}
function measureCard(ctx: CanvasRenderingContext2D, project: Project, locale: Locale): CardLayout {
  const textWidth = CARD_WIDTH - 64;
  setFont(ctx, 30, 600);
  const nameLines = wrapPosterText(
    ctx,
    project.name || copy(locale, '未命名项目', 'Untitled project'),
    textWidth,
    locale,
  );
  setFont(ctx, 25);
  const epitaphLines = wrapPosterText(
    ctx,
    project.epitaph ||
      copy(locale, '这里安睡着一个尚未完成的想法。', 'Here rests an unfinished idea.'),
    textWidth,
    locale,
  );
  setFont(ctx, 20);
  const causeLines = wrapPosterText(
    ctx,
    `${copy(locale, '死因（玩笑）：', 'Cause (in jest): ')}${project.cause || copy(locale, '明天一定继续写', 'Definitely finishing it tomorrow')}`,
    textWidth,
    locale,
  );
  setFont(ctx, 18);
  const commits =
    project.commits === null
      ? copy(locale, '提交数未知', 'Commit count unknown')
      : locale === 'en'
        ? `${project.commits.toLocaleString('en')} ${project.commits === 1 ? 'commit' : 'commits'}`
        : `${project.commits.toLocaleString('zh-CN')} 次 commit`;
  const language =
    !project.language || project.language === 'Unknown'
      ? copy(locale, '未知语言', 'Unknown language')
      : project.language;
  const metadataLines = wrapPosterText(ctx, `${language}  ·  ${commits}`, textWidth, locale);
  const height = Math.max(
    422,
    246 +
      nameLines.length * 39 +
      Math.max(0, metadataLines.length - 1) * 25 +
      epitaphLines.length * 37 +
      causeLines.length * 29,
  );
  return { project, nameLines, metadataLines, epitaphLines, causeLines, height };
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  layout: CardLayout,
  x: number,
  y: number,
  height: number,
  index: number,
  locale: Locale,
) {
  const { project, nameLines, metadataLines, epitaphLines, causeLines } = layout;
  ctx.fillStyle = COLORS.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, CARD_WIDTH, height, [80, 80, 5, 5]);
  ctx.fill();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  tombstone(ctx, x + CARD_WIDTH / 2, y + 52, 0.56);
  setFont(ctx, 16);
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(String(index + 1).padStart(2, '0'), x + 32, y + 62);
  ctx.textAlign = 'right';
  ctx.fillText(
    project.source === 'demo'
      ? copy(locale, '演示', 'DEMO')
      : project.source === 'github'
        ? 'GITHUB'
        : 'LOCAL',
    x + CARD_WIDTH - 32,
    y + 62,
  );
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.paper;
  setFont(ctx, 30, 600);
  let cursor = textLines(ctx, nameLines, x + CARD_WIDTH / 2, y + 124, 39);
  setFont(ctx, 16);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(
    `${formatPosterDate(project.createdAt, locale)} — ${formatPosterDate(project.lastCommitAt, locale)}`,
    x + CARD_WIDTH / 2,
    cursor + 6,
  );
  cursor += 39;
  setFont(ctx, 18);
  ctx.fillStyle = COLORS.moss;
  cursor = textLines(ctx, metadataLines, x + CARD_WIDTH / 2, cursor, 25);
  line(ctx, x + 32, cursor + 5, x + CARD_WIDTH - 32, cursor + 5);
  cursor += 44;
  setFont(ctx, 25);
  ctx.fillStyle = COLORS.paper;
  cursor = textLines(ctx, epitaphLines, x + CARD_WIDTH / 2, cursor, 37);
  cursor += 10;
  setFont(ctx, 20);
  ctx.fillStyle = COLORS.muted;
  textLines(ctx, causeLines, x + CARD_WIDTH / 2, cursor, 29);
  ctx.textAlign = 'left';
}

async function render(options: ExportOptions): Promise<Blob> {
  const locale = options.locale ?? 'zh-CN';
  if (typeof document === 'undefined')
    throw new Error(copy(locale, 'PNG 导出需要在浏览器中运行。', 'PNG export requires a browser.'));
  if (
    options.year !== 'all' &&
    (!Number.isInteger(options.year) || options.year < 1970 || options.year > 9999)
  )
    throw new Error(copy(locale, '请选择有效的年度。', 'Please select a valid year.'));
  const projects = selectExportProjects(options).map((project) => localizeProject(project, locale));
  if (!projects.length)
    throw new Error(
      copy(
        locale,
        '这个年度还没有入土项目，先去墓园选几个项目吧。',
        'No buried projects for this year yet. Try another year or return to the cemetery.',
      ),
    );
  if (document.fonts) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  const ctx = canvas.getContext('2d');
  if (!ctx)
    throw new Error(
      copy(
        locale,
        '当前浏览器无法创建长图画布，请更换浏览器重试。',
        'This browser could not create the poster canvas. Please try another browser.',
      ),
    );
  const cards = projects.map((project) => measureCard(ctx, project, locale));
  const rows: { height: number; cards: CardLayout[] }[] = [];
  for (let i = 0; i < cards.length; i += 2) {
    const pair = cards.slice(i, i + 2);
    rows.push({ height: Math.max(...pair.map((card) => card.height)), cards: pair });
  }
  const contentHeight = rows.reduce((sum, row) => sum + row.height + GAP, 0);
  const headerHeight = 622;
  const footerHeight = 190;
  const height = headerHeight + contentHeight + footerHeight;
  if (height > MAX_HEIGHT)
    throw new Error(
      copy(
        locale,
        `这份长图包含 ${projects.length} 个项目，超出浏览器的安全画布尺寸。请选择一个具体年度后再导出。`,
        `This poster contains ${projects.length} projects and exceeds the safe canvas size. Please select a specific year.`,
      ),
    );
  canvas.height = height;
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = 'alphabetic';

  // Thin editorial frame, restrained ink, and hand-drawn memorial details.
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 28, WIDTH - 56, height - 56);
  setFont(ctx, 17, 500);
  ctx.fillStyle = COLORS.moss;
  ctx.fillText(
    copy(locale, 'CODE CEMETERY  /  年度存档', 'CODE CEMETERY  /  ANNUAL ARCHIVE'),
    MARGIN,
    83,
  );
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(
    options.year === 'all' ? 'ALL THE UNFINISHED IDEAS' : `${options.year}  /  ANNUAL EDITION`,
    WIDTH - MARGIN,
    83,
  );
  ctx.textAlign = 'left';
  line(ctx, MARGIN, 109, WIDTH - MARGIN, 109);
  setFont(ctx, 76, 500, true);
  ctx.fillStyle = COLORS.paper;
  const title = copy(locale, '我的项目坟场', 'My Project Graveyard');
  for (let fontSize = 76; ctx.measureText(title).width > 770 && fontSize > 40; fontSize -= 2)
    setFont(ctx, fontSize, 500, true);
  ctx.fillText(title, MARGIN, 232);
  sparkle(ctx, 946, 195, 32);
  sparkle(ctx, 897, 237, 11);
  setFont(ctx, 25);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(
    copy(
      locale,
      '献给那些，差一点就改变世界的想法。',
      'For the ideas that almost changed the world.',
    ),
    MARGIN,
    291,
  );
  setFont(ctx, 19);
  ctx.fillStyle = COLORS.moss;
  const rawOwner = options.ownerName.trim();
  const owner =
    rawOwner === '一位不愿透露姓名的开发者'
      ? copy(locale, rawOwner, 'An anonymous developer')
      : rawOwner || copy(locale, '一位开发者', 'A developer');
  const ownerLines = wrapPosterText(
    ctx,
    `${copy(locale, '守墓人：', 'Caretaker: ')}${owner}`,
    WIDTH - MARGIN * 2,
    locale,
  );
  if (ownerLines.length > 2)
    throw new Error(
      copy(
        locale,
        '守墓人名字太长，请缩短后再生成长图。',
        'The caretaker name is too long. Please shorten it and try again.',
      ),
    );
  textLines(ctx, ownerLines, MARGIN, 343, 27);
  if (projects.every((project) => project.source === 'demo')) {
    ctx.textAlign = 'right';
    setFont(ctx, 16);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(
      copy(locale, '演示数据 · 仅供体验', 'DEMO DATA · FOR EXPLORATION'),
      WIDTH - MARGIN,
      391,
    );
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = '#203225';
  ctx.fillRect(MARGIN, 416, WIDTH - MARGIN * 2, 140);
  const knownProjects = projects.filter((project) => project.commits !== null);
  const knownCommits = knownProjects.reduce((total, project) => total + (project.commits ?? 0), 0);
  const flowers = projects.reduce((total, project) => total + project.flowers, 0);
  const metrics = [
    {
      value: String(projects.length).padStart(2, '0'),
      label: copy(locale, '个想法，暂时长眠', 'ideas, resting for now'),
    },
    {
      value: knownCommits.toLocaleString(locale),
      label:
        knownProjects.length === projects.length
          ? copy(locale, '次 commit，真心写过', 'commits, written with love')
          : copy(locale, '次已知 commit', 'known commits'),
    },
    {
      value: flowers.toLocaleString(locale),
      label: copy(locale, '朵花，献给曾经的热爱', 'flowers for what once was'),
    },
  ];
  metrics.forEach((metric, i) => {
    const x = MARGIN + 30 + i * ((WIDTH - MARGIN * 2) / 3);
    setFont(ctx, 44, 500, true);
    ctx.fillStyle = COLORS.paper;
    ctx.fillText(metric.value, x, 478);
    setFont(ctx, 16);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(metric.label, x, 516);
    if (i < 2) line(ctx, x + 269, 442, x + 269, 528);
  });
  setFont(ctx, 15);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(
    options.year === 'all'
      ? copy(
          locale,
          'IN LOVING MEMORY  /  所有长眠项目',
          'IN LOVING MEMORY  /  ALL RESTING PROJECTS',
        )
      : copy(
          locale,
          `IN LOVING MEMORY  /  最后提交于 ${options.year} 年的长眠项目`,
          `IN LOVING MEMORY  /  LAST COMMITTED IN ${options.year}`,
        ),
    MARGIN,
    599,
  );

  let y = headerHeight;
  let index = 0;
  for (const row of rows) {
    row.cards.forEach((card, i) =>
      drawCard(ctx, card, MARGIN + i * (CARD_WIDTH + GAP), y, row.height, index++, locale),
    );
    y += row.height + GAP;
  }
  line(ctx, MARGIN, y + 15, WIDTH - MARGIN, y + 15);
  ctx.textAlign = 'center';
  setFont(ctx, 26, 400, true);
  ctx.fillStyle = COLORS.paper;
  ctx.fillText(
    copy(
      locale,
      '每一个未完成，都曾经被认真期待。',
      'Every unfinished thing was once a beautiful possibility.',
    ),
    WIDTH / 2,
    y + 74,
  );
  setFont(ctx, 15);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(
    copy(
      locale,
      '代码墓地  ·  CODE CEMETERY  /  沉寂只是信号，墓志铭只是玩笑。',
      'CODE CEMETERY  /  Silence is a signal. Epitaphs are only jokes.',
    ),
    WIDTH / 2,
    y + 116,
  );
  ctx.textAlign = 'left';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(
              new Error(
                copy(
                  locale,
                  '长图生成失败，可能超出当前浏览器的内存限制。',
                  'Poster generation failed. The browser may have reached its memory limit.',
                ),
              ),
            ),
      'image/png',
    );
  });
}

export const annualPngExporter: ExporterPlugin = {
  id: 'annual-png',
  kind: 'exporter',
  version: '1.0.0',
  name: '年度项目坟场',
  description: '将长眠项目排版成 1080px 高清 PNG 长图，保留日期、墓志铭与献花。',
  export: render,
};
