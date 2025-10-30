import { useEffect, useState } from 'react';

import type { SortPreferences } from '../../infrastructure/config.js';
import { getDefaultSortPreferences, readSortPreferences, writeSortPreferences } from '../../infrastructure/config.js';

type UseSortPreferencesResult = {
  readonly sortPreferences: SortPreferences;
  readonly setSortPreferences: React.Dispatch<React.SetStateAction<SortPreferences>>;
  readonly isLoaded: boolean;
};

export const useSortPreferences = (): UseSortPreferencesResult => {
  const [sortPreferences, setSortPreferences] = useState<SortPreferences>(getDefaultSortPreferences());
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    void (async () => {
      try {
        const prefs = await readSortPreferences();
        setSortPreferences(prefs);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    void writeSortPreferences(sortPreferences);
  }, [isLoaded, sortPreferences]);

  return { sortPreferences, setSortPreferences, isLoaded };
};


