/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect } from 'react';
import ControlTray from './components/console/control-tray/ControlTray';
import ErrorScreen from './components/demo/ErrorScreen';
import StreamingConsole from './components/demo/streaming-console/StreamingConsole';
import LoginModal from './components/auth/LoginModal';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { LiveAPIProvider } from './contexts/LiveAPIContext';
import { useAuth, updateUserSettings } from './lib/auth';
import { useSettings } from './lib/state';
import { useHistoryStore } from './lib/history';
import AdminConsole from './components/admin/AdminConsole';

const normalizeEburonApiBase = (value: string) => {
  const input = value.trim();
  if (!input) return '/api/eburon';
  if (input.startsWith('/')) return input.replace(/\/$/, '') || '/api/eburon';

  try {
    const parsed = new URL(input);
    if (!parsed.pathname || parsed.pathname === '/') {
      parsed.pathname = '/api/eburon';
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return input;
  }
};

const EBURON_API_BASE = normalizeEburonApiBase(
  import.meta.env.VITE_EBURON_API_BASE || '/api/eburon'
);
const EBURON_LIVE_WS_URL = (import.meta.env.VITE_EBURON_LIVE_WS_URL || '').trim();

const isAllowedEburonApiBase = (value: string) => {
  if (value.startsWith('/api/eburon')) return true;

  try {
    const parsed = new URL(value);
    return /\.eburon\.ai$/i.test(parsed.hostname);
  } catch {
    return false;
  }
};

const isAllowedEburonWsUrl = (value: string) => {
  if (!value) return true;
  if (value.startsWith('/')) return value.startsWith('/api/eburon');

  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'wss:' || parsed.protocol === 'ws:') &&
      /\.eburon\.ai$/i.test(parsed.hostname)
    );
  } catch {
    return false;
  }
};

const isApiBaseAllowed = isAllowedEburonApiBase(EBURON_API_BASE);
const isLiveWsAllowed = isAllowedEburonWsUrl(EBURON_LIVE_WS_URL);
const isAdminRoute =
  typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

/**
 * Main application component that provides a streaming interface for Live API.
 * Manages video streaming state and provides controls for webcam/screen capture.
 */
function App() {
  const { user } = useAuth();
  const setActiveHistoryUser = useHistoryStore(state => state.setActiveUser);

  useEffect(() => {
    if (!user) return;

    const unsub = useSettings.subscribe((state, prevState) => {
      const changes: Partial<{ systemPrompt: string; voice1: string; voice2: string }> = {};
      if (state.systemPrompt !== prevState.systemPrompt) {
        changes.systemPrompt = state.systemPrompt;
      }
      if (state.voice1 !== prevState.voice1) {
        changes.voice1 = state.voice1;
      }
      if (state.voice2 !== prevState.voice2) {
        changes.voice2 = state.voice2;
      }
      if (Object.keys(changes).length > 0) {
        updateUserSettings(user.id, changes);
      }
    });

    return () => unsub();
  }, [user]);

  useEffect(() => {
    setActiveHistoryUser(user?.id || null);
  }, [user?.id, setActiveHistoryUser]);

  if (isAdminRoute) {
    return <AdminConsole />;
  }

  if (!isApiBaseAllowed || !isLiveWsAllowed) {
    return (
      <div className="App">
        <div className="error-screen">
          <div className="error-message-container">
            Invalid Eburon endpoint configuration. Use <code>VITE_EBURON_API_BASE</code> and
            optional <code>VITE_EBURON_LIVE_WS_URL</code> with Eburon domains only.
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  return (
    <div className="App">
      <LiveAPIProvider apiBase={EBURON_API_BASE} liveWsUrl={EBURON_LIVE_WS_URL || undefined}>
        <ErrorScreen />
        <Header />
        <Sidebar />
        <div className="streaming-console">
          <main>
            <div className="main-app-area">
              <StreamingConsole />
            </div>
            <ControlTray></ControlTray>
          </main>
        </div>
      </LiveAPIProvider>
    </div>
  );
}

export default App;
