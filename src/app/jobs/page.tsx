'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './jobs.css';

export default function MyJobs() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('All');
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  // Define the API base URL dynamically
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const savedId = localStorage.getItem('userId');
    if (!savedId) {
      router.push('/login');
    } else {
      setUserId(savedId);
      fetchJobs(savedId);
    }
  }, [router]);

  const fetchJobs = async (uid: string) => {
    try {
      // Data Ingestion: Fetching from the cloud or local source
      const res = await fetch(`${API_BASE_URL}/api/jobs/${uid}`);
      if (res.ok) {
        setJobs(await res.json());
      }
    } catch (err) {
      console.error("Data Pipeline Error: Failed to fetch jobs", err);
    }
  };

  const handleStatusChange = async (jobId: number, newStatus: string) => {
    try {
      // Data Transformation: Updating the record status in the warehouse
      const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        // Instant UI update
        setJobs((prev: any) =>
          prev.map((job: any) => job.id === jobId ? { ...job, status: newStatus } : job)
        );
      }
    } catch (err) {
      alert("Error updating status in cloud database");
    }
  };

  const filteredJobs = filter === 'All' 
    ? jobs 
    : jobs.filter((job: any) => job.status === filter);

  return (
    <div className="jobs-container">
      <main className="jobs-content">
        <header className="jobs-header">
          <h1>My Applications</h1>
          <div className="filter-wrapper">
            <label htmlFor="filter">Filter Status:</label>
            <select id="filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="All">All Stages</option>
              <option value="Applied">Applied</option>
              <option value="Pending">Apply in Future</option>
              <option value="Interviewing">Interviewing</option>
              <option value="Assessment">Assessment</option>
              <option value="Waiting for recruiter">Waiting for Recruiter</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </header>

        <div className="jobs-table-container">
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Company</th>
                <th>Current Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr><td colSpan={4} className="no-data">No applications found.</td></tr>
              ) : filteredJobs.map((job: any) => (
                <tr key={job.id} className={`status-row ${job.status.replace(/\s+/g, '-').toLowerCase()}`}>
                  <td><strong>{job.role_name}</strong></td>
                  <td>{job.company}</td>
                  <td><span className="status-pill">{job.status}</span></td>
                  <td>
                    <select 
                      className="inline-select"
                      value={job.status} 
                      onChange={(e) => handleStatusChange(job.id, e.target.value)}
                    >
                      <option value="Applied">Applied</option>
                      <option value="Pending">Apply in Future</option>
                      <option value="Interviewing">Interviewing</option>
                      <option value="Assessment">Assessment</option>
                      <option value="Waiting for recruiter">Waiting for Recruiter</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}