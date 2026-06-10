export interface SkillTemplate {
  name: string;
  description: string;
  instructions: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

export interface CommandTemplate {
  name: string;
  description: string;
  category: string;
  tags: string[];
  content: string;
}

export interface CommandContent {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  body: string;
}
