import { BookOpen, Bot, Coins, Dices, Globe, LayoutDashboard, Link2, Map, Palette, Podcast, Send, SlidersHorizontal, UtensilsCrossed } from 'lucide-react';
import type { ElementType } from 'react';
import type { CaseStudyIconKey } from './i18n/dictionaries/types';

export const caseStudyIcons: Record<CaseStudyIconKey, ElementType> = {
  podcast: Podcast,
  dashboard: LayoutDashboard,
  globe: Globe,
  map: Map,
  book: BookOpen,
  controls: SlidersHorizontal,
  credits: Coins,
  link: Link2,
  palette: Palette,
  dice: Dices,
  bot: Bot,
  utensils: UtensilsCrossed,
  send: Send,
};
