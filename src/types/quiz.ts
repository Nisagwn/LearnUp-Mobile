export type Difficulty = 'easy' | 'medium' | 'hard';

export type GenerateQuizModeKind =
  | 'ANALYZE_AND_DERIVE'
  | 'STRICT_CURRICULUM'
  | 'CREATIVE_FREE';

export type ExistingQuestionSample = {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation?: string;
};

type BaseGenerateArgs = {
  subject: string;
  topic?: string;
  grade: string;
  count: number;
  difficulty: Difficulty;
};

export type GenerateQuizMode =
  | ({ kind: 'ANALYZE_AND_DERIVE'; sampleQuestions: ExistingQuestionSample[] } & BaseGenerateArgs)
  | ({ kind: 'STRICT_CURRICULUM' } & BaseGenerateArgs)
  | ({ kind: 'CREATIVE_FREE' } & BaseGenerateArgs);

export function assertNeverMode(m: never): never {
  throw new Error(`Unhandled GenerateQuizMode: ${JSON.stringify(m)}`);
}
