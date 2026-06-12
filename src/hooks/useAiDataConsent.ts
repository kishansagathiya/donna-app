import { useCallback, useEffect, useState } from 'react';
import { hasAiDataConsent } from '../services/privacyConsent';

export function useAiDataConsent() {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const granted = await hasAiDataConsent();
    setAccepted(granted);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { accepted, refresh };
}
