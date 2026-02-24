/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import React, { useEffect, useState } from 'react';
import { useSettings } from '../../lib/state';

export interface ExtendedErrorType {
  code?: number;
  message?: string;
  status?: string;
}

export default function ErrorScreen() {
  const { client } = useLiveAPIContext();
  const { aliasName } = useSettings();
  const [error, setError] = useState<{ message?: string } | null>(null);

  useEffect(() => {
    function onError(error: ErrorEvent) {
      setError({ message: error.message });
    }

    client.on('error', onError);

    return () => {
      client.off('error', onError);
    };
  }, [client]);

  const message = (error?.message || '').toLowerCase();
  const errorMessage = message.includes('timeout')
    ? `${aliasName} is taking longer than expected. Please try again.`
    : message.includes('rate') || message.includes('quota') || message.includes('429')
      ? `${aliasName} is temporarily unavailable. Switching to a fallback route.`
      : `${aliasName} is temporarily unavailable. Please try again shortly.`;

  if (!error) {
    return <div style={{ display: 'none' }} />;
  }

  return (
    <div className="error-screen">
      <div
        style={{
          fontSize: 48,
        }}
      >
        💔
      </div>
      <div
        className="error-message-container"
        style={{
          fontSize: 22,
          lineHeight: 1.2,
          opacity: 0.5,
        }}
      >
        {errorMessage}
      </div>
      <button
        className="close-button"
        onClick={() => {
          setError(null);
        }}
      >
        Close
      </button>
    </div>
  );
}
