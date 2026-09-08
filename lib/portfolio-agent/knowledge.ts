// Approved public knowledge for the portfolio agent.
//
// NOTE: intentionally NOT `import 'server-only'` (unlike sibling server libs) —
// scripts/eval-agent-retrieval.ts imports this under plain tsx, where that
// package throws (same trade-off documented in scripts/create-token.ts). Safe
// because this module must only ever contain public content anyway.
//
// Source-of-truth decision (see AI_PORTFOLIO_AGENT_PLAN.md): chunks are derived
// programmatically from the i18n dictionaries — the same bilingual, reviewed
// content the site already renders — so the agent can never drift from the
// public site. Content with no dictionary home (the boundaries stance, the
// background summary, and the external-validation record) is hand-written here.
// Anything private simply has no path into this file.

import { enDictionary } from '@/lib/i18n/dictionaries/en';
import { heDictionary } from '@/lib/i18n/dictionaries/he';
import type { AppDictionary } from '@/lib/i18n/dictionaries/types';
import type { AgentLocale, KnowledgeChunk } from './types';

// Availability/job-search status is deliberately excluded from derived chunks
// (dossier.availability, hero.statusLabels): the assistant must not claim
// availability until that is explicitly approved as its own chunk.

const BOUNDARIES: Record<AgentLocale, string> = {
  en: [
    'This assistant only knows approved public information: profile, tech stack, projects, and contact links.',
    'It cannot discuss pricing, salary, delivery timelines, or availability — for those, contact Nehorai directly by email.',
    'It has no access to private data (messages, email, calendar, notes) and cannot send messages or perform actions.',
  ].join(' '),
  he: [
    'העוזר הזה מכיר רק מידע ציבורי מאושר: פרופיל, סטאק טכנולוגי, פרויקטים וקישורי יצירת קשר.',
    'הוא לא יכול לדון במחירים, שכר, לוחות זמנים או זמינות — לשם כך יש לפנות לנהוראי ישירות במייל.',
    'אין לו גישה למידע פרטי (הודעות, מייל, יומן, פתקים) והוא לא יכול לשלוח הודעות או לבצע פעולות.',
  ].join(' '),
};

// Background summary and external-validation record — public CV facts with no
// dictionary home. Mirrors the approved resume wording (EN/HE CV, Sept 2026):
// eval suites are "defined and run" by Nehorai, the hermes report is an
// authorization issue (not a "vulnerability"), and exactly one npm package is
// published (@nehorai/credits).
const BACKGROUND: Record<AgentLocale, string> = {
  en: [
    'Nehorai Hadad — AI Engineer | Full-Stack Developer.',
    '7+ years in on-prem infrastructure and datacenter operations (large-scale military datacenter environment; thousands of servers, plus networking and storage gear, mainly Cisco, HP and IBM) and 4+ years in software development.',
    'Builds production agents, retrieval systems, automation, and full-stack products.',
  ].join(' '),
  he: [
    'נהוראי חדד — AI Engineer | Full-Stack Developer.',
    'יותר מ-7 שנים בתשתיות on-prem ותפעול דטה-סנטרים (סביבת דטה-סנטר צבאית בקנה מידה גדול; אלפי שרתים וציוד תקשורת ואחסון, בעיקר Cisco, HP ו-IBM) ויותר מ-4 שנים בפיתוח תוכנה.',
    'בונה agents לפרודקשן, מערכות retrieval, אוטומציה ומוצרי full-stack.',
  ].join(' '),
};

const EXTERNAL_VALIDATION: Record<AgentLocale, string> = {
  en: [
    'External validation: Nehorai reported an authorization issue in NousResearch/hermes-agent that was confirmed within about 72 minutes, and he is credited in an open follow-up PR.',
    'He also has a merged PR in OpenClaw that suppresses model fallback notices in group conversations.',
    'On npm he published @nehorai/credits v2.0.0 — a framework-agnostic credits/billing package with reserve, commit/release, and audit-journal flows.',
  ].join(' '),
  he: [
    'אימות חיצוני: נהוראי דיווח על בעיית הרשאות ב-NousResearch/hermes-agent שאושרה תוך כ-72 דקות, ושמו מופיע ב-PR המשך פתוח.',
    'יש לו גם PR שמוזג ב-OpenClaw שמדכא הודעות fallback של מודלים בשיחות קבוצתיות.',
    'ב-npm פרסם את @nehorai/credits v2.0.0 — חבילת credits/חיוב framework-agnostic עם זרימות reserve, commit/release ויומן אודיט.',
  ].join(' '),
};

// Hebrew tag synonyms — chunk content derived from he.ts is Hebrew, but tags
// drive retrieval scoring, so Hebrew queries need Hebrew hooks too.
const HE_TAGS: Record<string, string[]> = {
  profile: ['פרופיל', 'רקע', 'ניסיון'],
  stack: ['סטאק', 'טכנולוגיות', 'טכנולוגיה', 'כלים', 'יכולות'],
  projects: ['פרויקט', 'פרויקטים', 'עבודות', 'בנית', 'בנה'],
  contact: ['קשר', 'צור קשר', 'מייל', 'אימייל', 'קורות חיים', 'לעבוד', 'יחד', 'העסקה'],
  boundaries: ['שכר', 'מחיר', 'מחירים', 'זמינות', 'פרטי'],
  background: ['רקע', 'ניסיון', 'שנים', 'תשתיות', 'דטה-סנטר', 'קורות חיים'],
  validation: ['אימות', 'קוד פתוח', 'תרומה', 'npm', 'hermes', 'openclaw'],
};

function localeTags(category: string, lang: AgentLocale): string[] {
  return lang === 'he' ? (HE_TAGS[category] ?? []) : [];
}

function deriveChunks(dict: AppDictionary, lang: AgentLocale): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  chunks.push({
    id: `profile-${lang}`,
    title: dict.hero.name,
    lang,
    category: 'profile',
    tags: ['profile', 'about', 'bio', 'role', 'ai engineer', 'full-stack', ...localeTags('profile', lang)],
    content: `${dict.meta.title}. ${dict.meta.description} ${dict.hero.subtitle} ${dict.dossier.description}`,
    public: true,
  });

  const stackLines = dict.dossier.stackLines
    .map((line) => `${line.tag}: ${line.stack}`)
    .join('\n');
  const skillGroups = dict.skills
    .map((group) => `${group.category}: ${group.items.join(', ')}`)
    .join('\n');
  chunks.push({
    id: `stack-${lang}`,
    title: dict.practice.title,
    lang,
    category: 'stack',
    tags: ['stack', 'skills', 'tech', 'technologies', 'tools', 'languages', ...localeTags('stack', lang)],
    content: `${stackLines}\n${skillGroups}`,
    public: true,
  });

  for (const study of dict.caseStudies) {
    const parts = [study.description, `Impact: ${study.impact}`];
    if (study.details) {
      parts.push(
        `Challenge: ${study.details.challenge}`,
        `Solution: ${study.details.solution}`,
        `Architecture: ${study.details.architecture.join(', ')}`,
      );
      if (study.details.liveUrl) parts.push(`Live: ${study.details.liveUrl}`);
      if (study.details.githubUrl) parts.push(`Code: ${study.details.githubUrl}`);
    }
    chunks.push({
      id: `project-${study.id}-${lang}`,
      title: study.title,
      lang,
      category: 'projects',
      tags: [
        'project',
        'projects',
        study.id,
        study.title.toLowerCase(),
        ...study.tags.map((t) => t.toLowerCase()),
        ...localeTags('projects', lang),
      ],
      content: parts.join('\n'),
      url: study.details?.liveUrl ?? study.details?.githubUrl,
      public: true,
    });
  }

  chunks.push({
    id: `contact-${lang}`,
    title: dict.dossier.contact.emailLabel,
    lang,
    category: 'contact',
    tags: ['contact', 'email', 'github', 'linkedin', 'reach', 'hire', 'together', 'collaborate', 'cv', 'resume', ...localeTags('contact', lang)],
    content: [
      `Email: ${dict.ownerContact.email}`,
      `GitHub: ${dict.ownerContact.githubUrl}`,
      `LinkedIn: ${dict.ownerContact.linkedinUrl}`,
      'Resume downloads:',
      ...dict.dossier.resumeOptions.map((o) => `- ${o.label}: ${o.file}`),
    ].join('\n'),
    url: dict.ownerContact.githubUrl,
    public: true,
  });

  chunks.push({
    id: `background-${lang}`,
    title: 'Background',
    lang,
    category: 'profile',
    tags: ['background', 'experience', 'years', 'infrastructure', 'datacenter', 'cv', 'resume', '7+ years', ...localeTags('background', lang)],
    content: BACKGROUND[lang],
    public: true,
  });

  chunks.push({
    id: `validation-${lang}`,
    title: 'External Validation',
    lang,
    category: 'projects',
    tags: ['open source', 'contribution', 'hermes', 'nousresearch', 'openclaw', 'npm', 'credits', 'merged pr', 'issue', ...localeTags('validation', lang)],
    content: EXTERNAL_VALIDATION[lang],
    url: 'https://www.npmjs.com/package/@nehorai/credits',
    public: true,
  });

  chunks.push({
    id: `boundaries-${lang}`,
    title: 'Boundaries',
    lang,
    category: 'boundaries',
    tags: ['boundaries', 'privacy', 'salary', 'pricing', 'availability', ...localeTags('boundaries', lang)],
    content: BOUNDARIES[lang],
    public: true,
  });

  return chunks;
}

const cache = new Map<AgentLocale, KnowledgeChunk[]>();

export function getKnowledge(locale: AgentLocale): KnowledgeChunk[] {
  let chunks = cache.get(locale);
  if (!chunks) {
    chunks = deriveChunks(locale === 'he' ? heDictionary : enDictionary, locale);
    cache.set(locale, chunks);
  }
  return chunks;
}
