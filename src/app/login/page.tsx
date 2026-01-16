'use client';
import { useState } from 'react';
import './auth.css';
import { useRouter } from 'next/navigation';


export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (response.ok) {

        // In a real app, we'd save this ID to use for job tracking
        localStorage.setItem('userId', data.userId || data.id);
        router.push('/dashboard');
      } else {
        setMessage(data.error || 'Something went wrong');
      }
    } catch (err) {
      setMessage('Failed to connect to backend server.');
    }
  };

  return (
  <div className="auth-container">
    <div className="auth-card">
      <h1>Job Tracker AI</h1>
      <h2>{isLogin ? 'Welcome back!' : 'Get started for free'}</h2>
      
      <form onSubmit={handleSubmit} className="auth-form">
        <input 
          type="email" placeholder="Email Address" value={email}
          onChange={(e) => setEmail(e.target.value)} required 
        />
        <input 
          type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required 
        />
        <button type="submit" className="auth-button">
          {isLogin ? 'Login' : 'Create Account'}
        </button>
      </form>

      <p className="auth-toggle-text">
        {isLogin ? "New here?" : "Already have an account?"} 
        <span className="auth-toggle-link" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? " Create an account" : " Sign in"}
        </span>
      </p>
      
      {message && <div className="auth-message">{message}</div>}
    </div>
  </div>
);}