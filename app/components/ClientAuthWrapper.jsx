'use client';

import { useState, useEffect } from 'react';

export default function ClientAuthWrapper({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const isAuth = sessionStorage.getItem('email_auth') === 'true';
    setAuthenticated(isAuth);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'admin' && password === 'secret123') {
      sessionStorage.setItem('email_auth', 'true');
      setAuthenticated(true);
    } else {
      setError('Invalid credentials');
    }
  };

  if (!authenticated) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f1f1f1',
        }}
      >
        <form
          onSubmit={handleLogin}
          style={{
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 0 12px rgba(0,0,0,0.1)',
            minWidth: '300px',
          }}
        >
          <h3>Admin Login</h3>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            Login
          </button>
        </form>
      </div>
    );
  }

  return children;
}
