import { useEffect, useRef, useState } from 'react';

import type { VisibilityPreferences } from '../../infrastructure/config.js';
import { getDefaultVisibilityPreferences, readVisibilityPreferences, writeVisibilityPreferences } from '../../infrastructure/config.js';

type UseVisibilityPreferencesResult = {
  readonly visibilityPreferences: VisibilityPreferences;
  readonly setVisibilityPreferences: React.Dispatch<React.SetStateAction<VisibilityPreferences>>;
  readonly isLoaded: boolean;
};

export const useVisibilityPreferences = (): UseVisibilityPreferencesResult => {
  const [visibilityPreferences, setVisibilityPreferences] = useState<VisibilityPreferences>(getDefaultVisibilityPreferences());
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    void (async () => {
      try {
        const prefs = await readVisibilityPreferences();
        setVisibilityPreferences(prefs);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    writeQueueRef.current = writeQueueRef.current
      .catch(() => undefined)
      .then(() => writeVisibilityPreferences(visibilityPreferences));
  }, [isLoaded, visibilityPreferences]);

  return { visibilityPreferences, setVisibilityPreferences, isLoaded };
};


