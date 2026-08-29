import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Mail, User, Check, Trash2, Clock, Send, Shield, UserCheck, Eye, RefreshCw, AlertCircle, Sparkles, Filter, ShieldAlert } from 'lucide-react';
import Navbar from '../components/Navbar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { safeExternalUrl } from '../utils/safeUrl';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search/Filters for Users
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');

  // Send Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Student');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [lastEmailPreview, setLastEmailPreview] = useState('');
  const [inviteMode, setInviteMode] = useState('single');
  const [inviteStatusFilter, setInviteStatusFilter] = useState('');
  const [inviteRoleFilter, setInviteRoleFilter] = useState('');

  const { token, user: loggedInUser } = useAuth();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
      setErrorMsg('Access Denied: You must be logged in as an administrator.');
      return;
    }
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (activeTab === 'projects') {
        const res = await axios.get(`${backendUrl}/api/projects`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProjects(res.data.projects || []);
      } else if (activeTab === 'users') {
        const res = await axios.get(`${backendUrl}/api/users?search=${userSearch}&role=${userRoleFilter}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data.users || []);
      } else if (activeTab === 'invitations') {
        const res = await axios.get(`${backendUrl}/api/auth/invitations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setInvitations(res.data.invitations || []);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Error loading dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Run user directory search when filters change
  useEffect(() => {
    if (activeTab === 'users' && token) {
      const delayDebounce = setTimeout(() => {
        fetchData();
      }, 300);
      return () => clearTimeout(delayDebounce);
    }
  }, [userSearch, userRoleFilter]);

  const handlePublishProject = async (projectId) => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      const res = await axios.patch(
        `${backendUrl}/api/projects/${projectId}/visibility`,
        { isPublic: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccessMsg('Project published and approved successfully!');
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to publish project');
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project? This action is permanent.')) return;
    try {
      setErrorMsg('');
      setSuccessMsg('');
      await axios.delete(`${backendUrl}/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccessMsg('Project deleted successfully.');
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      await axios.patch(
        `${backendUrl}/api/users/${userId}`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccessMsg('User role updated successfully.');
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update user role');
    }
  };

  const handleToggleUserVerification = async (userId, currentVerification) => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      await axios.patch(
        `${backendUrl}/api/users/${userId}`,
        { isVerified: !currentVerification },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccessMsg('User verification status toggled.');
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to toggle user verification');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? All their projects will also be deleted.')) return;
    try {
      setErrorMsg('');
      setSuccessMsg('');
      await axios.delete(`${backendUrl}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccessMsg('User and associated projects deleted successfully.');
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setLastEmailPreview('');
    try {
      const res = await axios.post(
        `${backendUrl}/api/auth/invite`,
        { email: inviteEmail, role: inviteRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccessMsg(`Invitation email successfully dispatched to ${inviteEmail}!`);
      if (res.data.previewUrl) {
        setLastEmailPreview(res.data.previewUrl);
      }
      setInviteEmail('');
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to generate invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/);
        if (lines.length <= 1) {
          setErrorMsg('CSV file is empty or missing data rows');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const emailIdx = headers.indexOf('email');
        const roleIdx = headers.indexOf('role');

        if (emailIdx === -1) {
          setErrorMsg("CSV must contain an 'email' column header.");
          return;
        }

        const parsedInvites = [];
        const validRoles = ['Student', 'Recruiter', 'Admin'];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = line.split(',').map(c => c.trim());
          const email = cols[emailIdx];
          let role = roleIdx !== -1 && cols[roleIdx] ? cols[roleIdx] : 'Student';

          if (role) {
            role = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
          }
          if (!validRoles.includes(role)) {
            role = 'Student';
          }

          if (email && email.includes('@')) {
            parsedInvites.push({ email, role });
          }
        }

        if (parsedInvites.length === 0) {
          setErrorMsg('No valid email rows found in the CSV');
          return;
        }

        setInviteLoading(true);
        setErrorMsg('');
        setSuccessMsg('');
        setLastEmailPreview('');

        const res = await axios.post(
          `${backendUrl}/api/auth/invite/bulk`,
          { invitations: parsedInvites },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const { successCount, failedCount, results } = res.data;
        let msg = `Processed ${successCount + failedCount} invites: ${successCount} succeeded`;
        if (failedCount > 0) {
          msg += `, ${failedCount} failed`;
        }
        setSuccessMsg(msg);

        const successWithPreview = results.find(r => r.success && r.previewUrl);
        if (successWithPreview) {
          setLastEmailPreview(successWithPreview.previewUrl);
        }

        fetchData();
      } catch (err) {
        console.error(err);
        setErrorMsg(err.response?.data?.message || 'Error processing CSV file');
      } finally {
        setInviteLoading(false);
        e.target.value = null;
      }
    };
    reader.readAsText(file);
  };

  if (!loggedInUser || loggedInUser.role !== 'Admin') {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-32 pb-12 px-6 flex items-center justify-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-200 bg-red-600/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="max-w-md w-full text-center relative z-10">
            <Card className="border-red-900/30">
              <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
              <p className="text-zinc-400 mb-6">This dashboard is restricted to logged-in administrator accounts only.</p>
              <a href="/login">
                <Button variant="primary">Return to Login</Button>
              </a>
            </Card>
          </div>
        </div>
      </>
    );
  }

  // Filter pending approval projects for Project Queue
  const pendingProjects = projects.filter(p => !p.isPublic);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background text-zinc-100 pt-24 pb-12 px-6 md:px-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-200 bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header Title */}
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-3.5">
            <div className="bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-500/30 shrink-0">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Admin <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 to-purple-400">Dashboard</span>
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Manage project approvals, users, and invite portal members.
              </p>
            </div>
          </div>
          <button 
            onClick={fetchData} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Global Alerts */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 rounded-xl bg-red-900/20 border border-red-800/50 text-red-400 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
          {successMsg && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 rounded-xl bg-emerald-900/20 border border-emerald-800/50 text-emerald-400 flex items-center gap-3">
              <Check className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p>{successMsg}</p>
                {lastEmailPreview && (
                  <p className="text-sm mt-1">
                    <Sparkles className="w-4 h-4 inline-block mr-1 text-emerald-400 animate-pulse" />
                    <strong>Dev Mode Mail Preview:</strong>{' '}
                    <a href={lastEmailPreview} target="_blank" rel="noopener noreferrer" className="underline text-indigo-400 hover:text-indigo-300 font-semibold ml-1">
                      Open Ethereal Mailbox
                    </a>
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('projects')}
            className={`py-4 px-6 font-medium text-sm border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'projects'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Project Queue ({pendingProjects.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-4 px-6 font-medium text-sm border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            User Management ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`py-4 px-6 font-medium text-sm border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'invitations'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Invitation Log ({invitations.length})
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex justify-center items-center py-20 z-10">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          )}

          {/* PROJECT APPROVAL QUEUE */}
          {activeTab === 'projects' && (
            <div className="space-y-6">
              {pendingProjects.length === 0 ? (
                <Card className="text-center py-12">
                  <div className="text-zinc-500 text-lg mb-2">No projects pending approval</div>
                  <p className="text-zinc-400 text-sm max-w-md mx-auto">
                    All created student projects are published or public visibility is up-to-date.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {pendingProjects.map((project) => (
                    <Card key={project.id} className="relative group overflow-hidden border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                      <div className="flex flex-col lg:flex-row gap-6">
                        
                        {/* Cover Image */}
                        {project.coverImage ? (
                          <img
                            src={project.coverImage.startsWith('http') ? project.coverImage : `${backendUrl}${project.coverImage}`}
                            alt={project.title}
                            className="w-full lg:w-48 h-32 object-cover rounded-xl"
                          />
                        ) : (
                          <div className="w-full lg:w-48 h-32 rounded-xl bg-linear-to-r from-indigo-500/20 to-purple-500/20 border border-zinc-800 flex items-center justify-center text-zinc-600 font-semibold">
                            No Cover
                          </div>
                        )}

                        {/* Text and Actions */}
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-xl font-bold text-white">{project.title}</h3>
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Pending Approval
                              </span>
                            </div>
                            <p className="text-zinc-400 text-sm line-clamp-2 mb-3">{project.description}</p>
                            
                            {/* Author & Tech */}
                            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                              <span className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-zinc-400" />
                                {project.studentId?.name || 'Unknown Student'} ({project.studentId?.email || 'N/A'})
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {project.technologiesUsed?.map((tech, idx) => (
                                  <span key={idx} className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[10px]">
                                    {tech}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Approval Actions */}
                          <div className="mt-6 flex items-center gap-3 flex-wrap">
                            <Button 
                              onClick={() => handlePublishProject(project.id)}
                              variant="primary"
                              className="px-6 py-2.5 text-sm rounded-xl!"
                            >
                              <Check className="w-4 h-4" /> Publish / Make Public
                            </Button>
                            {safeExternalUrl(project.demoUrl) && (
                              <a href={safeExternalUrl(project.demoUrl)} target="_blank" rel="noopener noreferrer">
                                <Button 
                                  variant="secondary"
                                  className="px-6 py-2.5 text-sm rounded-xl!"
                                >
                                  <Eye className="w-4 h-4" /> View Live Demo
                                </Button>
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteProject(project.id)}
                              className="ml-auto text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2.5 rounded-xl border border-transparent hover:border-red-900/30 transition-all"
                              title="Delete unethical or unwanted project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* USER MANAGEMENT DIRECTORY */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              
              {/* Directory Filter controls */}
              <div className="flex flex-col md:flex-row gap-4 bg-zinc-900/30 p-4 border border-zinc-800 rounded-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">All Roles</option>
                    <option value="Student">Students</option>
                    <option value="Recruiter">Recruiters</option>
                    <option value="Admin">Admins</option>
                  </select>
                </div>
              </div>

              {/* Users table */}
              <Card className="p-0 overflow-hidden border border-zinc-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-zinc-300 text-sm">
                    <thead className="bg-zinc-900/80 text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-800">
                      <tr>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Verification</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 bg-zinc-900/10">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-zinc-500">
                            No users matched your search criteria.
                          </td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user.id} className="hover:bg-zinc-800/10 transition-colors">
                            <td className="px-6 py-4 font-semibold text-white flex items-center gap-3">
                              {user.profilePicture ? (
                                <img
                                  src={user.profilePicture}
                                  alt={user.name}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              {user.name}
                            </td>
                            <td className="px-6 py-4 text-zinc-400">{user.email}</td>
                            <td className="px-6 py-4">
                              <select
                                value={user.role}
                                onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                                className="bg-zinc-800 border border-zinc-700 rounded-lg py-1 px-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="Student">Student</option>
                                <option value="Recruiter">Recruiter</option>
                                <option value="Admin">Admin</option>
                              </select>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleToggleUserVerification(user.id, user.isVerified)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                  user.isVerified
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                }`}
                              >
                                <UserCheck className="w-3 h-3" />
                                {user.isVerified ? 'Verified' : 'Unverified'}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 rounded-xl transition-colors border border-transparent hover:border-red-900/30"
                                title="Delete user account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* INVITATION MANAGER & LOG */}
          {activeTab === 'invitations' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Send Invitation Form */}
              <div className="lg:col-span-1">
                <Card className="h-fit border border-zinc-800">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-400" /> Send Invite Link
                  </h3>
                  
                  {/* Sub-tabs: Single / Bulk */}
                  <div className="flex border-b border-zinc-800 mb-6">
                    <button
                      onClick={() => setInviteMode('single')}
                      className={`flex-1 pb-3 text-center text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                        inviteMode === 'single'
                          ? 'border-indigo-500 text-indigo-400 font-bold'
                          : 'border-transparent text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Single Invite
                    </button>
                    <button
                      onClick={() => setInviteMode('bulk')}
                      className={`flex-1 pb-3 text-center text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                        inviteMode === 'bulk'
                          ? 'border-indigo-500 text-indigo-400 font-bold'
                          : 'border-transparent text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Bulk Import (CSV)
                    </button>
                  </div>

                  {inviteMode === 'single' ? (
                    <>
                      <p className="text-xs text-zinc-400 mb-6">
                        Enter the candidate email address and role. This sends an invitation link containing registration validation.
                      </p>
                      
                      <form onSubmit={handleSendInvite} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                            Recipient Email
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                              type="email"
                              required
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="student@university.edu"
                              className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                            Invite Role
                          </label>
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="Student">Student</option>
                            <option value="Recruiter">Recruiter</option>
                            <option value="Admin">Admin</option>
                          </select>
                        </div>

                        <Button
                          type="submit"
                          disabled={inviteLoading}
                          fullWidth
                          className="mt-6 py-3 text-sm rounded-xl! font-semibold flex items-center justify-center gap-2"
                        >
                          {inviteLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          Dispatch Invitation
                        </Button>
                      </form>
                    </>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-xs text-zinc-400">
                        Upload a CSV file containing candidate emails and roles to dispatch multiple invitations simultaneously.
                      </p>
                      
                      <div className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 rounded-2xl p-6 text-center transition-colors relative group">
                        <Mail className="w-8 h-8 text-zinc-500 group-hover:text-indigo-400 mx-auto mb-3 transition-colors" />
                        <label className="block text-sm font-semibold text-white mb-1 cursor-pointer">
                          <span className="text-indigo-400 hover:text-indigo-300">Click to upload CSV file</span>
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleCsvUpload}
                            disabled={inviteLoading}
                            className="hidden"
                          />
                        </label>
                        <span className="text-[11px] text-zinc-500">Supports column headers: <strong>email</strong>, <strong>role</strong></span>
                      </div>

                      <a 
                        href="/sample_invitations.csv" 
                        download="sample_invitations.csv"
                        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                      >
                        <Check className="w-4 h-4 text-emerald-400 animate-pulse" /> Download Sample CSV Template
                      </a>
                    </div>
                  )}
                </Card>
              </div>

              {/* Sent Invitations Logs */}
              <div className="lg:col-span-2">
                <Card className="p-0 overflow-hidden border border-zinc-800">
                  <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400" /> Invitation Logs
                    </h3>
                    
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <select
                        value={inviteStatusFilter}
                        onChange={(e) => setInviteStatusFilter(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">All Statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                      </select>
                      
                      <select
                        value={inviteRoleFilter}
                        onChange={(e) => setInviteRoleFilter(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">All Roles</option>
                        <option value="Student">Student</option>
                        <option value="Recruiter">Recruiter</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-zinc-300 text-sm">
                      <thead className="bg-zinc-900/30 text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-800">
                        <tr>
                          <th className="px-6 py-3">Recipient</th>
                          <th className="px-6 py-3">Role</th>
                          <th className="px-6 py-3">Sent At</th>
                          <th className="px-6 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {(() => {
                          const filteredInvitations = invitations.filter((inv) => {
                            const matchesStatus = inviteStatusFilter ? inv.status === inviteStatusFilter : true;
                            const matchesRole = inviteRoleFilter ? inv.role === inviteRoleFilter : true;
                            return matchesStatus && matchesRole;
                          });

                          if (filteredInvitations.length === 0) {
                            return (
                              <tr>
                                <td colSpan="4" className="px-6 py-12 text-center text-zinc-500">
                                  No matching invitation records found.
                                </td>
                              </tr>
                            );
                          }

                          return filteredInvitations.map((inv) => (
                            <tr key={inv.id} className="hover:bg-zinc-800/5 transition-colors">
                              <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                                <Mail className="w-4 h-4 text-zinc-500" />
                                {inv.email}
                              </td>
                              <td className="px-6 py-4 text-zinc-400">{inv.role}</td>
                              <td className="px-6 py-4 text-zinc-500 text-xs">
                                {new Date(inv.sentAt).toLocaleString()}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                    inv.status === 'Completed'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
    </>
  );
};

export default AdminDashboard;
