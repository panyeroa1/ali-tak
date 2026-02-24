import React, { FormEvent, useMemo, useState } from 'react';
import {
  createManagedStaffId,
  listManagedStaffIds,
  useAuth,
} from '../../lib/auth';

export default function AdminConsole() {
  const { user, isSuperAdmin, signInWithId, signOut } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [requestedId, setRequestedId] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seed, setSeed] = useState(0);

  const staffIds = useMemo(() => listManagedStaffIds(), [seed]);

  const refresh = () => setSeed(prev => prev + 1);

  const handleSuperAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithId(loginId.toUpperCase());
      setLoginId('');
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateId = (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setCreatedId('');

    try {
      const created = createManagedStaffId(user.id, requestedId || undefined);
      setCreatedId(created.id);
      setRequestedId('');
      refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to create staff ID.');
    }
  };

  if (!user) {
    return (
      <div className="admin-page">
        <div className="admin-card">
          <h1>Admin Console</h1>
          <p>Sign in with super admin ID to manage staff IDs.</p>
          <form onSubmit={handleSuperAdminLogin} className="admin-form">
            <input
              type="text"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              placeholder="SI0000"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !loginId}>
              {loading ? 'Verifying...' : 'Enter Admin'}
            </button>
          </form>
          {error ? <p className="admin-error">{error}</p> : null}
          <a href="/" className="admin-link">
            Back to Translator
          </a>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-card">
          <h1>Admin Console</h1>
          <p>Access denied. Super admin privileges are required.</p>
          <div className="admin-actions">
            <button onClick={signOut}>Sign Out</button>
            <a href="/" className="admin-link">
              Back to Translator
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-card">
        <div className="admin-header">
          <h1>Admin Console</h1>
          <div className="admin-actions">
            <a href="/" className="admin-link">
              Open Translator
            </a>
            <button onClick={signOut}>Sign Out</button>
          </div>
        </div>

        <form onSubmit={handleCreateId} className="admin-form">
          <label htmlFor="staff-id-input">Create Staff ID</label>
          <input
            id="staff-id-input"
            type="text"
            value={requestedId}
            onChange={e => setRequestedId(e.target.value.toUpperCase())}
            placeholder="Leave empty for auto (SI0001...)"
          />
          <button type="submit">Create ID</button>
        </form>

        {createdId ? <p className="admin-success">Created: {createdId}</p> : null}
        {error ? <p className="admin-error">{error}</p> : null}

        <section className="admin-list">
          <h2>Active Staff IDs</h2>
          {staffIds.length === 0 ? (
            <p>No staff IDs created yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Created At</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                {staffIds.map(item => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>{item.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
