import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  ExternalLink,
  ArrowLeft,
  Trash2,
  Edit3,
  CheckCircle,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserPlus,
  Shield,
  Eye,
  X,
  Loader2,
  Globe2
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { safeExternalUrl } from '../utils/safeUrl';

// Custom GitHub icon component since Lucide v1.0+ removed brand icons
const Github = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

/* ─────────────────────────── helpers ─────────────────────────── */
const BASE_URL = import.meta.env.VITE_BACKEND_URL;

const gradients = [
  'from-indigo-500/30 to-purple-600/30',
  'from-emerald-500/30 to-teal-600/30',
  'from-orange-500/30 to-rose-600/30',
  'from-pink-500/30 to-fuchsia-600/30',
  'from-sky-500/30 to-blue-600/30',
];

const techColors = [
  'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  'bg-purple-500/10 text-purple-400 border-purple-500/30',
  'bg-teal-500/10 text-teal-400 border-teal-500/30',
  'bg-rose-500/10 text-rose-400 border-rose-500/30',
  'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'bg-sky-500/10 text-sky-400 border-sky-500/30',
];

/* ─────────────────────────── component ─────────────────────────── */
const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Gallery
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Likes
  const [totalLikes, setTotalLikes] = useState(0);
  const [userLiked, setUserLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  // Follow (recruiter)
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Admin / owner actions
  const [actionLoading, setActionLoading] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const authHeaders = { Authorization: `Bearer ${token}` };

  /* ── fetch project ── */
  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BASE_URL}/api/projects/${id}`, { headers: authHeaders });
      setProject(res.data.project);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load project.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* ── fetch likes ── */
  const fetchLikes = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/projects/${id}/likes`, { headers: authHeaders });
      setTotalLikes(res.data.totalLikes);
      setUserLiked(res.data.userLiked);
    } catch {
      // silently ignore
    }
  }, [id]);

  /* ── fetch follow status (recruiter only) ── */
  const fetchFollowStatus = useCallback(async (studentId) => {
    if (user?.role !== 'Recruiter') return;
    try {
      const res = await axios.get(`${BASE_URL}/api/users/${studentId}/follow-status`, { headers: authHeaders });
      setIsFollowing(res.data.isFollowing);
    } catch {
      // silently ignore
    }
  }, [user?.role]);

  useEffect(() => {
    fetchProject();
    fetchLikes();
  }, [fetchProject, fetchLikes]);

  useEffect(() => {
    if (project?.studentId?.id || project?.studentId?._id) {
      fetchFollowStatus(project.studentId.id || project.studentId._id);
    }
  }, [project, fetchFollowStatus]);

  /* ── gallery images ── */
  const allImages = project
    ? [project.coverImage, ...(project.additionalImages || [])].filter(Boolean)
    : [];

  /* ── resolve image src ── */
  const imgSrc = (img) => img.startsWith('http') ? img : `${BASE_URL}${img}`;

  /* ── like toggle ── */
  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      const res = await axios.post(`${BASE_URL}/api/projects/${id}/likes`, {}, { headers: authHeaders });
      setTotalLikes(res.data.totalLikes);
      setUserLiked(res.data.action === 'liked');
    } catch (err) {
      console.error('Like failed', err);
    } finally {
      setLikeLoading(false);
    }
  };

  /* ── follow toggle ── */
  const handleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    const studentId = project.studentId.id || project.studentId._id;
    try {
      await axios.post(`${BASE_URL}/api/users/${studentId}/follow`, {}, { headers: authHeaders });
      setIsFollowing(prev => !prev);
    } catch (err) {
      console.error('Follow failed', err);
    } finally {
      setFollowLoading(false);
    }
  };

  /* ── visibility toggle (admin) ── */
  const handleToggleVisibility = async () => {
    setActionLoading('visibility');
    try {
      await axios.patch(
        `${BASE_URL}/api/projects/${id}/visibility`,
        { isPublic: !project.isPublic },
        { headers: authHeaders }
      );
      setProject(prev => ({ ...prev, isPublic: !prev.isPublic }));
    } catch (err) {
      console.error('Visibility update failed', err);
    } finally {
      setActionLoading('');
    }
  };

  /* ── delete project ── */
  const handleDelete = async () => {
    setActionLoading('delete');
    try {
      await axios.delete(`${BASE_URL}/api/projects/${id}`, { headers: authHeaders });
      navigate('/projects');
    } catch (err) {
      console.error('Delete failed', err);
      setActionLoading('');
    }
  };

  /* ── derived role flags ── */
  const isOwner = user && project && (
    project.studentId?.id?.toString() === user.id?.toString() ||
    project.studentId?._id?.toString() === user.id?.toString()
  );
  const isAdmin = user?.role === 'Admin';
  const isRecruiter = user?.role === 'Recruiter';

  /* ── loading state ── */
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full"
          />
        </div>
      </>
    );
  }

  /* ── error state ── */
  if (error || !project) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <p className="text-red-400 text-lg font-medium">{error || 'Project not found.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </>
    );
  }

  const authorName = project.studentId?.name || 'Anonymous Student';
  const authorAvatar = project.studentId?.profilePicture
    ? `${BASE_URL}${project.studentId.profilePicture}`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&color=fff`;
  const gradientClass = gradients[authorName.length % gradients.length];
  const demoUrl = safeExternalUrl(project.demoUrl);
  const gitRepoUrl = safeExternalUrl(project.gitRepoUrl);

  return (
    <>
      <Navbar />

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxOpen && allImages.length > 0 && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-200 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.85 }}
              className="relative max-w-5xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={imgSrc(allImages[lightboxIndex])}
                alt={`Screenshot ${lightboxIndex + 1}`}
                className="w-full max-h-[80vh] object-contain rounded-2xl"
              />
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute -top-4 -right-4 bg-zinc-800 hover:bg-zinc-700 rounded-full p-2 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={() => setLightboxIndex(i => (i - 1 + allImages.length) % allImages.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 rounded-full p-3 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <button
                    onClick={() => setLightboxIndex(i => (i + 1) % allImages.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 rounded-full p-3 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                </>
              )}
              <p className="text-center text-zinc-400 text-sm mt-3">
                {lightboxIndex + 1} / {allImages.length}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirm Modal ── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-200 bg-black/70 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-surface border border-zinc-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-2">Delete Project?</h3>
              <p className="text-zinc-400 text-sm mb-6">
                This action is permanent and cannot be undone. The project and all its data will be removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading === 'delete'}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {actionLoading === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page ── */}
      <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">

        {/* Back */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8 text-sm group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Go Back
        </motion.button>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* ────────── LEFT: Main Content ────────── */}
          <div className="xl:col-span-2 space-y-6">

            {/* Hero image / gallery */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-3xl overflow-hidden bg-surface border border-zinc-800"
            >
              {allImages.length > 0 ? (
                <>
                  <div
                    className="relative h-72 sm:h-96 cursor-zoom-in"
                    onClick={() => { setLightboxIndex(activeImageIndex); setLightboxOpen(true); }}
                  >
                    <div className={`absolute inset-0 bg-linear-to-br ${gradientClass} opacity-40 z-10`} />
                    <img
                      src={imgSrc(allImages[activeImageIndex])}
                      alt={project.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-3 right-3 z-20 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                      <Eye className="w-3 h-3" /> Click to expand
                    </div>
                  </div>

                  {/* Thumbnails */}
                  {allImages.length > 1 && (
                    <div className="flex gap-2 p-3 overflow-x-auto">
                      {allImages.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveImageIndex(i)}
                          className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                            i === activeImageIndex ? 'border-indigo-500' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={imgSrc(img)}
                            alt={`thumb ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className={`h-64 bg-linear-to-br ${gradientClass} flex items-center justify-center`}>
                  <span className="text-zinc-400 text-lg font-medium">No Images Provided</span>
                </div>
              )}
            </motion.div>

            {/* Title & status badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-wrap items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">{project.title}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                    project.isPublic
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {project.isPublic ? <Globe2 className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {project.isPublic ? 'Public' : 'Private / Pending Approval'}
                  </span>
                </div>
              </div>

              {/* Like button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleLike}
                disabled={likeLoading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-medium text-sm border transition-all duration-200 cursor-pointer ${
                  userLiked
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-rose-400'
                }`}
                id="like-button"
              >
                <Heart className={`w-5 h-5 transition-all ${userLiked ? 'fill-rose-400 text-rose-400' : ''} ${likeLoading ? 'animate-pulse' : ''}`} />
                <span className="font-bold">{totalLikes}</span>
                <span className="hidden sm:inline">{userLiked ? 'Liked' : 'Like'}</span>
              </motion.button>
            </motion.div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-surface border border-zinc-800 rounded-2xl p-6"
            >
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">About this project</h2>
              <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{project.description}</p>
            </motion.div>

            {/* Technologies */}
            {project.technologiesUsed?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-surface border border-zinc-800 rounded-2xl p-6"
              >
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Technologies Used</h2>
                <div className="flex flex-wrap gap-2">
                  {project.technologiesUsed.map((tech, i) => (
                    <span
                      key={tech}
                      className={`text-sm px-3 py-1.5 rounded-xl border font-medium ${techColors[i % techColors.length]}`}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Links */}
            {(demoUrl || gitRepoUrl) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-surface border border-zinc-800 rounded-2xl p-6"
              >
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Links</h2>
                <div className="flex flex-wrap gap-3">
                  {demoUrl && (
                    <a
                      href={demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      id="demo-link"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all duration-200 shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Live Demo
                    </a>
                  )}
                  {gitRepoUrl && (
                    <a
                      href={gitRepoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      id="git-link"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium border border-zinc-700 transition-colors"
                    >
                      <Github className="w-4 h-4" />
                      View Repository
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* ────────── RIGHT: Sidebar ────────── */}
          <div className="space-y-5">

            {/* Author card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-surface border border-zinc-800 rounded-2xl p-6"
            >
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Created by</h3>
              <div className="flex items-center gap-4">
                <div className="min-w-0">
                  <p className="text-white font-semibold text-base truncate">{authorName}</p>
                  <p className="text-zinc-500 text-sm truncate">{project.studentId?.email || ''}</p>
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Student</span>
                </div>
              </div>

              {/* Recruiter: Follow button */}
              {isRecruiter && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleFollow}
                  disabled={followLoading}
                  id="follow-student-btn"
                  className={`mt-5 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium border transition-all duration-200 cursor-pointer ${
                    isFollowing
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                  }`}
                >
                  {followLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isFollowing ? (
                    <><UserCheck className="w-4 h-4" /> Following</>
                  ) : (
                    <><UserPlus className="w-4 h-4" /> Follow Student</>
                  )}
                </motion.button>
              )}
            </motion.div>

            {/* Project meta */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-surface border border-zinc-800 rounded-2xl p-6 space-y-3"
            >
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Project Info</h3>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Created</span>
                <span className="text-zinc-300">{new Date(project.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Updated</span>
                <span className="text-zinc-300">{new Date(project.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Total Likes</span>
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 fill-rose-400" /> {totalLikes}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Visibility</span>
                <span className={project.isPublic ? 'text-emerald-400' : 'text-amber-400'}>
                  {project.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
            </motion.div>

            {/* ── ADMIN controls ── */}
            {isAdmin && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-surface border border-indigo-500/20 rounded-2xl p-6 space-y-3"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Admin Controls</h3>
                </div>

                {/* Approve / Make Public */}
                <button
                  onClick={handleToggleVisibility}
                  disabled={actionLoading === 'visibility'}
                  id="toggle-visibility-btn"
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium border transition-all duration-200 cursor-pointer disabled:opacity-60 ${
                    project.isPublic
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}
                >
                  {actionLoading === 'visibility' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : project.isPublic ? (
                    <><EyeOff className="w-4 h-4" /> Make Private</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Approve &amp; Make Public</>
                  )}
                </button>

                {/* Delete */}
                <button
                  onClick={() => setConfirmDelete(true)}
                  id="admin-delete-btn"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium border bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 transition-all duration-200 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Delete Project
                </button>
              </motion.div>
            )}

            {/* ── OWNER controls (student who owns the project) ── */}
            {isOwner && !isAdmin && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-surface border border-zinc-800 rounded-2xl p-6 space-y-3"
              >
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Your Project</h3>

                {/* Edit */}
                <Link
                  to={`/projects/${id}/edit`}
                  id="edit-project-btn"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                >
                  <Edit3 className="w-4 h-4" /> Edit Project
                </Link>

                {/* Delete */}
                <button
                  onClick={() => setConfirmDelete(true)}
                  id="owner-delete-btn"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium border bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 transition-all duration-200 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Delete Project
                </button>
              </motion.div>
            )}

          </div>
        </div>
      </div>
    </>
  );
};

export default ProjectDetail;
