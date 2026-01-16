'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import './navbar.css';
export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 1. Check login status on mount and when pathname changes
  useEffect(() => {
    const checkAuth = () => {
      const userId = localStorage.getItem('userId');
      setIsLoggedIn(!!userId);
    };

    checkAuth();
    
    // Optional: Listen for storage events (useful if logging in/out in other tabs)
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    router.push('/login');
  };

  // 2. Conditional Rendering: Only show Navbar content if logged in
  if (!isLoggedIn) {
    return null; // This completely hides the Navbar on login/register pages
  }

  return (
    <nav className="dashboard-nav">
      <div className="nav-left">
        <h2>JobTracker AI</h2>
        <div className="nav-links">
          <Link 
            href="/dashboard" 
            className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
          >
            Add Job
          </Link>
          <Link 
            href="/jobs" 
            className={`nav-item ${pathname === '/jobs' ? 'active' : ''}`}
          >
            My Jobs
          </Link>
        </div>
      </div>
      <button className="logout-btn" onClick={handleLogout}>Logout</button>
    </nav>
  );
}