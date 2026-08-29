import React from 'react';
import { motion } from 'framer-motion';
import { Heart, ExternalLink, Edit3, Trash2, Globe, Clock, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { safeExternalUrl } from '../utils/safeUrl';

const defaultGradients = [
  "from-blue-500/20 to-purple-500/20",
  "from-emerald-500/20 to-teal-500/20",
  "from-orange-500/20 to-red-500/20",
  "from-indigo-500/20 to-blue-500/20",
];

const getFullImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  const separator = url.startsWith('/') ? '' : '/';
  return `${backendUrl}${separator}${url}`;
};

const ProjectCard = ({
  project,
  index = 0,
  isOwner = false,
  showStatusBadge = false,
  showAuthorBadge = false,
  showAuthorFooter = false,
  showLikeButton = false,
  isLiked = false,
  onLike,
  onEdit,
  onDelete,
  hoverBorderClass = 'hover:border-indigo-500/30',
  hoverTextClass = 'group-hover:text-indigo-400',
  variants
}) => {
  const navigate = useNavigate();
  const gradient = defaultGradients[index % defaultGradients.length];

  // Helper to extract student details safely
  const studentName = project.studentName || project.studentId?.name || 'Unknown Student';
  const studentAvatar = project.studentId?.avatar || project.studentId?.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=4F46E5&color=fff`;

  // Technologies rendering
  const techList = project.technologies || project.technologiesUsed || [];
  const demoUrl = safeExternalUrl(project.demoUrl || project.demoLink);

  const handleCardClick = () => {
    navigate(`/projects/${project.id || project._id}`);
  };

  return (
    <motion.div
      variants={variants}
      onClick={handleCardClick}
      className={`group glass border border-zinc-800/50 rounded-3xl overflow-hidden ${hoverBorderClass} transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] flex flex-col relative cursor-pointer`}
    >
      {/* ────────── TOP IMAGE / COVER ────────── */}
      <div className="relative h-48 w-full overflow-hidden shrink-0 bg-zinc-900">
        <div className={`absolute inset-0 bg-linear-to-br ${gradient} mix-blend-overlay z-10 opacity-60 group-hover:opacity-40 transition-opacity`}></div>
        {project.coverImage ? (
          <img
            src={getFullImageUrl(project.coverImage)}
            alt={project.title}
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center border-b border-zinc-800/50 text-zinc-700">
            <ImageIcon size={40} />
          </div>
        )}

        {/* --- Overlay: Like Button --- */}
        {showLikeButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onLike) onLike(project.id || project._id);
            }}
            className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-black/60 transition-all group/btn shadow-xl"
          >
            <Heart className={`w-5 h-5 transition-colors ${isLiked ? 'fill-rose-500 text-rose-500' : 'text-white/80 group-hover/btn:text-rose-400'}`} />
          </button>
        )}

        {/* --- Overlay: Status Badge (My Portfolio) --- */}
        {showStatusBadge && (
          <div className="absolute top-4 right-4 z-20">
            <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 backdrop-blur-md border ${
              project.status === 'Public' || project.isPublic
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {project.status === 'Public' || project.isPublic ? <Globe size={12} /> : <Clock size={12} />}
              {project.status || (project.isPublic ? 'Public' : 'Private / Pending Approval')}
            </div>
          </div>
        )}

        {/* --- Overlay: Author Badge (Peer Showcase Card Top Left) --- */}
        {showAuthorBadge && (
          <div className="absolute top-4 left-4 z-20">
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center gap-2">
              <img src={studentAvatar} alt={studentName} className="w-4 h-4 rounded-full object-cover" />
              <span className="truncate max-w-25">{studentName}</span>
            </div>
          </div>
        )}
      </div>

      {/* ────────── CARD BODY ────────── */}
      <div className="p-6 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-3">
          <h3 className={`text-xl font-bold text-white ${hoverTextClass} transition-colors line-clamp-1 pr-4`}>
            {project.title}
          </h3>
          {demoUrl && (
            <a
              href={demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`text-zinc-500 ${hoverTextClass} transition-colors shrink-0`}
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          )}
        </div>

        <p className="text-zinc-400 text-sm line-clamp-2 mb-4 flex-1">
          {project.description}
        </p>

        {/* Tech Stack Badges */}
        <div className="flex flex-wrap gap-2 mb-5">
          {techList.slice(0, 3).map((tech, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-zinc-800/50 text-zinc-300 border border-zinc-700/50">
              {tech}
            </span>
          ))}
          {techList.length > 3 && (
            <span className="text-xs px-2.5 py-1 rounded-md bg-zinc-800/50 text-zinc-500 border border-zinc-700/50">
              +{techList.length - 3}
            </span>
          )}
        </div>

        {/* ────────── CARD FOOTER ────────── */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50 mt-auto">
          {/* Left Footer Action */}
          {showAuthorFooter ? (
            <div className="flex items-center gap-3">
              <img
                src={studentAvatar}
                alt={studentName}
                className="w-8 h-8 rounded-full ring-2 ring-zinc-900 object-cover"
              />
              <span className="text-sm font-medium text-zinc-300">{studentName}</span>
            </div>
          ) : (
            // Owner view demo link
            <a
              href={demoUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-zinc-400 hover:text-white flex items-center gap-1.5 text-sm transition-colors"
            >
              <ExternalLink size={14} /> View Demo
            </a>
          )}

          {/* Right Footer Action */}
          {isOwner && (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEdit) onEdit(project);
                }}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-indigo-400 transition-colors"
                title="Edit Project"
              >
                <Edit3 size={16} />
              </button>
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDelete) onDelete(project.id || project._id);
                  }}
                  className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
                  title="Delete Project"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}

          {!isOwner && !showAuthorFooter && (
            <div className="inline-flex items-center gap-1.5 text-sm text-indigo-400 group-hover:text-indigo-300 font-medium transition-colors">
              View Details <ChevronRight size={14} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProjectCard;
