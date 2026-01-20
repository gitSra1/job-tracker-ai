'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './dashboard.css';

export default function Dashboard() {
  // 1. Form State
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(''); 
  const [resume, setResume] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState<File | null>(null);
  const [setReminder, setSetReminder] = useState(false);
  
  // 2. Data State
  const [jobs, setJobs] = useState([]);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  // 3. Auth Guard & Initial Fetch
  useEffect(() => {
    const savedId = localStorage.getItem('userId');
    if (!savedId) {
      router.push('/login');
    } else {
      setUserId(savedId);
      fetchUserJobs(savedId);
    }
  }, [router]);

  const fetchUserJobs = async (uid: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/jobs/${uid}`);
      if (res.ok) setJobs(await res.json());
    } catch (err) {
      console.error("Failed to load jobs");
    }
  };

  // 4. Submit Logic
  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!status) {
      alert("Please select a status");
      return;
    }

    const formData = new FormData();
    formData.append('role_name', role);
    formData.append('company', company);
    formData.append('job_url', url);
    formData.append('job_description', description);
    formData.append('status', status);
    formData.append('user_id', userId || '');
    formData.append('reminder_enabled', String(setReminder));
    
    if (resume) formData.append('resume', resume);
    if (coverLetter) formData.append('coverLetter', coverLetter);

    try {
      const response = await fetch('https://job-tracker-ai.onrender.com', {
        method: 'POST',
        body: formData, 
      });

      if (response.ok) {
        alert("Application saved!");
        setRole(''); setCompany(''); setUrl(''); setDescription('');
        setStatus(''); setResume(null); setCoverLetter(null); setSetReminder(false);
        fetchUserJobs(userId!); 
      }
    } catch (err) {
      alert("Connection to backend failed.");
    }
  };

  return (
    <div className="dashboard-container">
      {/* Navbar is now handled by the global Layout/Navbar component */}
      
      <main className="dashboard-grid">
        <section className="form-section">
          <h2>Track New Opportunity</h2>
          <form onSubmit={handleSaveJob} className="dashboard-form">
            <div className="form-row">
              <div className="input-group">
                <label htmlFor="role_name">Job Title</label>
                <input 
                  id="role_name" name="role_name" type="text" placeholder="e.g. SOC Analyst" 
                  value={role} onChange={e => setRole(e.target.value)} required 
                />
              </div>
              <div className="input-group">
                <label htmlFor="company">Company</label>
                <input 
                  id="company" name="company" type="text" placeholder="e.g. TechCorp" 
                  value={company} onChange={e => setCompany(e.target.value)} required 
                />
              </div>
            </div>
            
            <label htmlFor="status">Current Status</label>
            <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="status-select" required>
              <option value="">-- Select Option --</option>
              <option value="Pending">Apply in Future</option>
              <option value="Applied">Applied</option>
            </select>

            {status === 'Applied' && (
              <div className="upload-group">
                <label htmlFor="resume">Upload Resume</label>
                <input id="resume" type="file" onChange={(e) => setResume(e.target.files?.[0] || null)} />
                <label htmlFor="coverLetter">Upload Cover Letter (Optional)</label>
                <input id="coverLetter" type="file" onChange={(e) => setCoverLetter(e.target.files?.[0] || null)} />
              </div>
            )}

            {status === 'Pending' && (
              <div className="reminder-group">
                <label>
                  <input type="checkbox" checked={setReminder} onChange={(e) => setSetReminder(e.target.checked)} />
                  Email me a reminder every 12 hours?
                </label>
              </div>
            )}

            <label htmlFor="url">Posting URL</label>
            <input id="url" name="url" type="url" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
            
            <label htmlFor="description">Job Description</label>
            <textarea id="description" name="description" placeholder="Paste full text here..." value={description} onChange={e => setDescription(e.target.value)} required />
            
            <button type="submit" className="save-btn">Save Application</button>
          </form>
        </section>

        <section className="list-section">
          <h2>Your History</h2>
          <div className="job-cards-container">
            {jobs.length === 0 ? <p className="empty-msg">No jobs tracked yet.</p> : jobs.map((job: any) => (
              <div key={job.id} className="job-card">
                <h3>{job.role_name}</h3>
                <p>{job.company}</p>
                <span className={`badge ${job.status}`}>{job.status}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}