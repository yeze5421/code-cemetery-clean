import type { Locale, Project } from '../core/types';
import { DEMO_PROJECTS } from '../data/demo';

type DemoCopy = Pick<Project, 'description' | 'epitaph' | 'cause'>;
const englishDemoCopy: Record<string, DemoCopy> = {
  'demo:todo-for-real': {
    description: 'The to-do app I would actually use this time',
    epitaph: 'Built a to-do list.\nThe only unfinished task was finishing it.',
    cause: 'Too many ideas, not enough hours',
  },
  'demo:next-big-thing': {
    description: 'The next world-changing unicorn',
    epitaph: 'A hundred-million-dollar valuation.\nTwo hundred lines of code.',
    cause: 'The business plan outgrew the code',
  },
  'demo:personal-blog-v3': {
    description: 'The third rewrite of a personal blog',
    epitaph: 'Three new frameworks.\nStill just one Hello World post.',
    cause: 'Refactored the blog. Forgot to write.',
  },
  'demo:ai-everything': {
    description: 'An ambitious attempt to put AI in everything',
    epitaph: 'Wanted AI to do my work.\nIt spent my entire balance instead.',
    cause: 'The API credits went first',
  },
  'demo:side-project-007': {
    description: 'The seventh side project that would be different',
    epitaph: 'This time will be different.\nExactly what I said last time.',
    cause: 'Found an even better idea',
  },
  'demo:learn-rust-in-7days': {
    description: 'A seven-day plan to master Rust',
    epitaph: 'The borrow checker would not let go.\nSo I did.',
    cause: 'A lesson in lifetimes',
  },
  'demo:tiny-weather': {
    description: 'A little tool that still checks the weather',
    epitaph: 'Still showing up for another update.',
    cause: 'Still growing',
  },
  'demo:pixel-garden': {
    description: 'A few pixel plants for the desktop',
    epitaph: 'One more watering. Maybe tomorrow it will bloom.',
    cause: 'Still growing',
  },
};

/** View-only localization. Repository content and user edits are never rewritten. */
export function localizeProject(project: Project, locale: Locale): Project {
  const view = { ...project };
  if (locale !== 'en' || project.source !== 'demo') return view;
  const original = DEMO_PROJECTS.find((example) => example.id === project.id);
  const translated = englishDemoCopy[project.id];
  if (!original || !translated) return view;
  for (const field of ['description', 'epitaph', 'cause'] as const) {
    if (project[field] === original[field]) view[field] = translated[field];
  }
  return view;
}
