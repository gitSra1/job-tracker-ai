'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname(); // Helps us highlight the active page

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

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