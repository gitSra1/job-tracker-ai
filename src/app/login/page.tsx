'use client';
import { useState } from 'react';
import './auth.css';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // DYNAMIC ENDPOINT: Switches based on whether user is Logging in or Registering
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://job-tracker-ai.onrender.com';

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('userId', data.userId);
        router.push('/dashboard');
      } else {
        setMessage(data.error || 'Authentication failed');
      }
    } catch (err) {
      setMessage('Cannot reach the server. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Job Tracker AI</h1>
        <h2>{isLogin ? 'Welcome back!' : 'Create your account'}</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>

        <p className="auth-toggle-text">
          {isLogin ? "Don't have an account?" : "Already a member?"}
          <span className="auth-toggle-link" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? " Register now" : " Sign in"}
          </span>
        </p>

        {message && <div className={`auth-message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>}
      </div>
    </div>
  );
}