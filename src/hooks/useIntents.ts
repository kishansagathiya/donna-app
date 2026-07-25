import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { intentsQueryKeys } from '../lib/intentsQueryKeys';
import {
  cancelActionRun,
  confirmActionRun,
  dismissIntent,
  listIntents,
  type Intent,
} from '../services/intentsApi';

export function useOpenIntents(enabled = true) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: userId
      ? intentsQueryKeys.open(userId)
      : ['intents', 'anon', 'open'],
    enabled: Boolean(userId) && enabled,
    queryFn: () => listIntents('open'),
    staleTime: 30_000,
    placeholderData: prev => prev,
  });
}

export function useIntentActions() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const invalidate = async () => {
    if (!userId) {
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: intentsQueryKeys.all(userId),
    });
  };

  const confirmMutation = useMutation({
    mutationFn: (runId: string) => confirmActionRun(runId),
    onSuccess: invalidate,
  });

  const cancelMutation = useMutation({
    mutationFn: (runId: string) => cancelActionRun(runId),
    onSuccess: invalidate,
  });

  const dismissMutation = useMutation({
    mutationFn: (intentId: string) => dismissIntent(intentId),
    onMutate: async intentId => {
      if (!userId) {
        return;
      }
      await queryClient.cancelQueries({
        queryKey: intentsQueryKeys.open(userId),
      });
      const previous = queryClient.getQueryData<Intent[]>(
        intentsQueryKeys.open(userId),
      );
      queryClient.setQueryData<Intent[]>(
        intentsQueryKeys.open(userId),
        prev => (prev ?? []).filter(item => item.id !== intentId),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (!userId || !ctx?.previous) {
        return;
      }
      queryClient.setQueryData(intentsQueryKeys.open(userId), ctx.previous);
    },
    onSettled: invalidate,
  });

  return { confirmMutation, cancelMutation, dismissMutation, invalidate };
}
