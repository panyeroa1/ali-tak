
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import { ConversationTurn } from './state';
import { logAliasEvent } from './alias-log';

const SUPABASE_URL = 'https://gkaszpjcfdkehoivihju.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrYXN6cGpjZmRrZWhvaXZpaGp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MjQwMjMsImV4cCI6MjA3NTMwMDAyM30.u0dxNr1LbH31OmlT7KzloKI6V_k-8uWOCslg3PE9UYw';
const SUPER_ADMIN_ID = 'SI0000';
const STAFF_ID_STORAGE_KEY = 'eburon-managed-staff-ids';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface ManagedStaffId {
  id: string;
  createdAt: string;
  createdBy: string;
}

const isValidStaffId = (id: string) => /^SI\d{4}$/.test(id);

const getStoredStaffIds = (): ManagedStaffId[] => {
  if (typeof window === 'undefined') return [];

  const raw = localStorage.getItem(STAFF_ID_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ManagedStaffId[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => isValidStaffId(item.id));
  } catch {
    return [];
  }
};

const persistStaffIds = (items: ManagedStaffId[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STAFF_ID_STORAGE_KEY, JSON.stringify(items));
};

export const listManagedStaffIds = () => {
  const ids = getStoredStaffIds();
  return ids.sort((a, b) => {
    if (a.id === SUPER_ADMIN_ID) return -1;
    if (b.id === SUPER_ADMIN_ID) return 1;
    return a.id.localeCompare(b.id);
  });
};

export const createManagedStaffId = (createdBy: string, requestedId?: string) => {
  if (createdBy !== SUPER_ADMIN_ID) {
    throw new Error('Only super admin can create staff IDs.');
  }

  const existing = getStoredStaffIds();
  const normalizedRequested = (requestedId || '').trim().toUpperCase();

  let nextId = normalizedRequested;
  if (!nextId) {
    const takenNumbers = new Set(
      existing
        .map(item => item.id)
        .filter(id => /^SI\d{4}$/.test(id))
        .map(id => Number(id.slice(2)))
    );

    for (let i = 1; i <= 9999; i++) {
      if (!takenNumbers.has(i)) {
        nextId = `SI${String(i).padStart(4, '0')}`;
        break;
      }
    }
  }

  if (!isValidStaffId(nextId)) {
    throw new Error('Staff ID must match format SI0001.');
  }
  if (nextId === SUPER_ADMIN_ID) {
    throw new Error('SI0000 is reserved for super admin.');
  }
  if (existing.some(item => item.id === nextId)) {
    throw new Error('Staff ID already exists.');
  }

  const created: ManagedStaffId = {
    id: nextId,
    createdAt: new Date().toISOString(),
    createdBy,
  };

  persistStaffIds([...existing, created]);
  return created;
};

const isManagedStaffId = (id: string) => {
  if (id === SUPER_ADMIN_ID) return true;
  return getStoredStaffIds().some(item => item.id === id);
};

// --- AUTH STORE ---
interface AuthState {
  session: any | null;
  user: { id: string; email: string; } | null;
  isSuperAdmin: boolean;
  loading: boolean;
  loadingData: boolean;
  signInWithId: (id: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  signOut: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  user: null,
  isSuperAdmin: false,
  loading: false,
  loadingData: false,
  signInWithId: async (id: string) => {
    // Basic validation: SI followed by 4 characters
    const normalizedId = id.toUpperCase().trim();
    const isValid = isValidStaffId(normalizedId);
    if (!isValid) {
      throw new Error('Invalid ID format. Must match SI0001.');
    }

    if (!isManagedStaffId(normalizedId)) {
      throw new Error('Unknown Staff ID. Ask an admin to create your ID.');
    }

    set({
      user: { id: normalizedId, email: `${normalizedId}@eburon.ai` },
      session: { id: normalizedId },
      isSuperAdmin: normalizedId === SUPER_ADMIN_ID, // SI0000 is super admin
    });
  },
  signInWithPassword: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    const user = data.user;
    if (!user) {
      throw new Error('Unable to sign in.');
    }

    set({
      user: { id: user.id, email: user.email || email },
      session: data.session,
      isSuperAdmin: false,
    });
  },
  signUp: async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  },
  sendPasswordResetEmail: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },
  signOut: () => set({ user: null, session: null, isSuperAdmin: false }),
}));

// --- DATABASE HELPERS ---
export const updateUserSettings = async (userId: string, newSettings: Partial<{ systemPrompt: string; voice: string }>) => {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...newSettings });
  if (error) {
    logAliasEvent({
      alias: 'orbit-v3.2',
      task_type: 'chat',
      error_class: 'storage_error',
    });
  }
  return Promise.resolve();
};

export const fetchUserConversations = async (userId: string): Promise<ConversationTurn[]> => {
  const { data, error } = await supabase
    .from('translations')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: true });

  if (error) {
    logAliasEvent({
      alias: 'orbit-v3.2',
      task_type: 'chat',
      error_class: 'storage_error',
    });
    return [];
  }

  return data.map(item => ({
    timestamp: new Date(item.timestamp),
    role: item.role,
    text: item.text,
    isFinal: true
  }));
};

export const updateUserConversations = async (userId: string, turns: ConversationTurn[]) => {
  const lastTurn = turns[turns.length - 1];
  if (!lastTurn || !lastTurn.isFinal) return;

  const { error } = await supabase
    .from('translations')
    .insert({
      user_id: userId,
      role: lastTurn.role,
      text: lastTurn.text,
      timestamp: lastTurn.timestamp.toISOString(),
    });

  if (error) {
    logAliasEvent({
      alias: 'orbit-v3.2',
      task_type: 'chat',
      error_class: 'storage_error',
    });
  }
};

export const clearUserConversations = async (userId: string) => {
  const { error } = await supabase
    .from('translations')
    .delete()
    .eq('user_id', userId);
  if (error) {
    logAliasEvent({
      alias: 'orbit-v3.2',
      task_type: 'chat',
      error_class: 'storage_error',
    });
  }
};
