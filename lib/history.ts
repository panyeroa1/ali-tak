/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface HistoryItem {
  id: number;
  sourceText: string;
  translatedText: string;
  lang1: string;
  lang2: string;
  timestamp: Date;
}

interface HistoryState {
  activeUserId: string | null;
  historyByUser: Record<string, HistoryItem[]>;
  history: HistoryItem[];
  setActiveUser: (userId: string | null) => void;
  addHistoryItem: (item: {
    sourceText: string,
    translatedText: string,
    lang1: string,
    lang2: string,
  }, userId?: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      activeUserId: null,
      historyByUser: {},
      history: [],
      setActiveUser: userId =>
        set(state => ({
          activeUserId: userId,
          history: userId ? state.historyByUser[userId] || [] : [],
        })),
      addHistoryItem: (item, userId) =>
        set(state => {
          const targetUserId = userId || state.activeUserId;
          if (!targetUserId) {
            return state;
          }

          const nextItem: HistoryItem = {
            ...item,
            id: Date.now(),
            timestamp: new Date(),
          };
          const nextUserHistory = [nextItem, ...(state.historyByUser[targetUserId] || [])];
          return {
            historyByUser: {
              ...state.historyByUser,
              [targetUserId]: nextUserHistory,
            },
            history:
              state.activeUserId === targetUserId ? nextUserHistory : state.history,
          };
        }),
      clearHistory: () =>
        set(state => {
          if (!state.activeUserId) {
            return { history: [] };
          }
          return {
            historyByUser: {
              ...state.historyByUser,
              [state.activeUserId]: [],
            },
            history: [],
          };
        }),
    }),
    {
      name: 'translation-history-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
