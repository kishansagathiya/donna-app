export const intentsQueryKeys = {
  all: (userId: string) => ['intents', userId] as const,
  open: (userId: string) => [...intentsQueryKeys.all(userId), 'open'] as const,
};
