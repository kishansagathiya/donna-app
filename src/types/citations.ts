export type MemoryCitation = {
  source: 'fact' | 'note' | string;
  id?: string;
  text: string;
  score?: number;
  url?: string;
  title?: string;
};
