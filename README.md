# UniShowcase Security Assessment Report

This repository contains the UniShowcase platform and the security work completed as part of the university assessment. This README records the project overview, implemented security controls, confirmed vulnerabilities, remediation steps, testing evidence, and final security status.

---

## 1. Project Overview

### Purpose
UniShowcase is a university-focused project showcase and recruitment platform. It allows students to publish their work, recruiters to discover talent, and administrators to manage access and approval workflows.

### Main Features
- Student project creation, editing, and management
- Private-by-default project visibility model
- Recruiter publication approval workflow
- User search and filtering
- Likes and engagement features
- Admin invitation management and access control
- Real-time notifications over Socket.IO
- Google-based login and invite-controlled registration

### Technology Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB with Mongoose
- Authentication: Google ID token validation + JWT
- Real-time communication: Socket.IO
- Email: Nodemailer
- Cloud storage: Cloudinary
- Configuration: dotenv

### Architecture
- Frontend React application for dashboard, project pages, and user flows
- Express REST API for authentication, projects, interactions, users, notifications
- Mongoose models for users, projects, invitations, likes, and followers
- Middleware for JWT verification, role checks, and upload enforcement
- Socket.IO service for authenticated real-time notifications

Relevant project files:
- Backend/src/app.js
- Backend/src/routes/
- Backend/src/services/
- Backend/src/middlewares/
- Backend/src/models/
- frontend/src/

---

## 2. Authentication

### Login Flow
The platform uses Google ID-token verification before creating or authenticating a user. The backend validates the token at the Google tokeninfo endpoint then creates or updates the local account record.

Key implementation:
- Backend/src/controllers/authController.js
- Backend/src/services/authService.js

### Identity Provider
The application uses Google as the identity provider. The backend verifies the Google ID token audience matches the configured client ID.

### Token Flow
- Invite tokens are JWTs with the `INVITE` type and role/email claims
- User tokens are JWTs containing user ID, email, and role
- Tokens are validated on protected API requests and WebSocket connections

### JWT Generation and Validation
Generation is handled in:
- Backend/src/utils/inviteGenerator.js

Validation is enforced in:
- Backend/src/middlewares/authMiddleware.js
- Backend/src/app.js

Current security requirement:
- The application refuses to start if `JWT_SECRET` is missing or shorter than 32 characters.

### Logout
The frontend removes the stored JWT and user state and disconnects the active socket connection.

Relevant file:
- frontend/src/context/AuthContext.jsx

### Protected Routes
Protected endpoints use `protect` middleware and specific role middleware. Route protection is defined in:
- Backend/src/routes/projectRoutes.js
- Backend/src/middlewares/authMiddleware.js
- Backend/src/middlewares/roleMiddleware.js

---

## 3. Authorization

### User Roles
The application defines the following user roles:
- Student
- Recruiter
- Admin

Defined in:
- Backend/src/models/User.js

### Permissions
- Students can create and manage their own projects
- Recruiters can view public content, publish project visibility, and follow students
- Admins can manage invitations, approve publication, and perform user management tasks

### Backend Access-Control Implementation
Access control is enforced using:
- JWT-based authentication middleware
- Role-based middleware (`restrictTo`)
- Ownership checks within service methods

Relevant files:
- Backend/src/middlewares/roleMiddleware.js
- Backend/src/services/projectService.js
- Backend/src/services/interactionService.js

### Ownership Checks
The project service checks whether the current user is the owner or admin before allowing edits, deletion, or access to private projects.

Example pattern:
- project.studentId matches user ID
- admin role bypasses only the privileged admin logic as intended

---

## 4. Vulnerability Findings

### 4.1 Default / Hard-Coded JWT Secret
- Vulnerability name: Default / hard-coded JWT secret
- OWASP Top 10 category: A05 Security Misconfiguration
- Severity: High
- Exact file path: Backend/.env.example, Backend/src/app.js, Backend/src/utils/inviteGenerator.js
- Function/class: startup validation, `generateInviteToken`, `generateUserToken`
- Vulnerable implementation: Secret was not consistently required at runtime; insecure or missing values could be accepted.
- Why it was vulnerable: A predictable or default signing secret enables token forgery.
- Attack scenario: An attacker obtains or reuses the default signing secret and signs arbitrary JWTs to impersonate users.
- Security impact: Account takeover and privilege escalation.
- Fix implemented: The application now fails startup when `JWT_SECRET` is missing or under 32 characters.
- Important before/after code:

Before:
```env
JWT_SECRET=your_jwt_secret_key
```

After:
```js
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
  throw new Error('JWT_SECRET must be configured and contain at least 32 characters');
}
```

- Testing procedure: Start app without or with short secret; verify startup failure; then run with valid secret.
- Before-fix result: App could start with insecure key configuration.
- After-fix result: App blocks insecure configuration.
- Git commit message: `security: remove default JWT secret and enforce environment configuration`

### 4.2 Reusable Invitation Token / Invitation Not Bound to Email
- Vulnerability name: Reusable invitation token / invitation not bound to email
- OWASP Top 10 category: A07 Identification and Authentication Failures
- Severity: High
- Exact file path: Backend/src/services/authService.js, Backend/src/utils/inviteGenerator.js, Backend/src/models/Invitation.js
- Function/class: `AuthService.processUserRegistration`, `validateInvite`, `verifyInviteToken`
- Vulnerable implementation: The token could be reused and was not properly bound to the invited email address.
- Why it was vulnerable: A token that is not email-bound can be replayed or used by the wrong account.
- Attack scenario: A leaked invitation token is used by another person to register a different account.
- Security impact: Unauthorized account creation and role-based privilege misuse.
- Fix implemented: The email in the invite is checked against the user’s verified Google email, and invitation status is marked as consumed atomically.
- Important before/after code:

Before:
```js
const decodedInvite = this.validateInvite(inviteToken);
// no email check enforced against the current user
```

After:
```js
const invitedEmail = typeof decodedInvite.email === 'string'
  ? decodedInvite.email.trim().toLowerCase()
  : '';

if (invitedEmail !== normalizedEmail) {
  throw new Error('This invitation was issued for a different email address');
}

consumedInvitation = await Invitation.findOneAndUpdate(
  {
    token: inviteToken,
    email: normalizedEmail,
    role: decodedInvite.role,
    status: 'Pending'
  },
  { $set: { status: 'Completed' } },
  { new: true }
);
```

- Testing procedure: Attempt register with matching valid invite, mismatched email, and reused token.
- Before-fix result: Same invitation could be reused or applied to a different email.
- After-fix result: Matching email and single-use token requirement enforced.
- Git commit message: `security: make invitation tokens single-use and bind them to invited email`

### 4.3 Private Project IDOR
- Vulnerability name: Private project IDOR
- OWASP Top 10 category: A01 Broken Access Control
- Severity: High
- Exact file path: Backend/src/services/projectService.js, Backend/src/services/interactionService.js, Backend/src/controllers/projectController.js
- Function/class: `getProjectById`, `toggleLike`, `getLikesForProject`, `canAccessProject`
- Vulnerable implementation: Private project access was not enforced consistently across all project-related endpoints.
- Why it was vulnerable: An attacker could enumerate or guess project IDs and access protected records.
- Attack scenario: A user modifies the project ID in the request and requests a private project they do not own.
- Security impact: Unauthorized viewing of private student portfolio content and interaction data.
- Fix implemented: Access is granted only when project is public, user owns it, or user is admin.
- Important before/after code:

Before:
```js
if (!project.isPublic && !isOwner) throw new Error('Access denied: Private project');
```

After:
```js
const canAccessProject = (project, user) => {
  if (project.isPublic || user.role === 'Admin') return true;
  const projectOwnerId = project.studentId._id || project.studentId;
  return projectOwnerId.toString() === (user._id || user.id).toString();
};
```

- Testing procedure: Query a private project ID as unauthorized user, as owner, and as admin.
- Before-fix result: Some project detail endpoints did not properly block unauthorized access.
- After-fix result: Unauthorized access is blocked.
- Git commit message: `security: enforce authorization for private project access`

### 4.4 Student Project Publication / Approval Bypass
- Vulnerability name: Student project publication / approval bypass
- OWASP Top 10 category: A01 Broken Access Control
- Severity: High
- Exact file path: Backend/src/services/projectService.js, Backend/src/routes/projectRoutes.js
- Function/class: `createProject`, `updateProject`, `updateVisibility`
- Vulnerable implementation: Student-controlled requests could set `isPublic` directly in create or update.
- Why it was vulnerable: The platform requires visibility changes to be privileged, not client-controlled.
- Attack scenario: A student submits `isPublic: true` to bypass the recruiter/admin approval workflow.
- Security impact: Publishing without approval and bypassing review process.
- Fix implemented: `isPublic` is ignored in student create/update paths and only the recruiter/admin visibility endpoint can change it.
- Important before/after code:

Before:
```js
isPublic: projectData.isPublic === 'true' || projectData.isPublic === true
```

After:
```js
// Project approval is a privileged operation. Never accept visibility
// from a student-controlled create request.
isPublic: false
```

and:
```js
// Visibility changes are handled only by updateVisibility, which requires
// the Recruiter or Admin role. Ignore any isPublic value in normal edits.
```

- Testing procedure: Attempt to create or update with `isPublic: true` as a student; test recruiter/admin publish route separately.
- Before-fix result: Students could force public visibility directly.
- After-fix result: Only privileged route can publish.
- Git commit message: `security: prevent students from bypassing project approval workflow`

### 4.5 Unauthenticated Socket.IO Registration
- Vulnerability name: Unauthenticated Socket.IO registration
- OWASP Top 10 category: A01 Broken Access Control
- Severity: High
- Exact file path: Backend/src/app.js, frontend/src/context/AuthContext.jsx, Backend/src/socket/socketManager.js
- Function/class: `io.use`, `AuthProvider`, `registerSocket`
- Vulnerable implementation: Client could emit a `register` event with any `userId` and attach to a socket without verifying identity.
- Why it was vulnerable: Identity was taken from a client-controlled payload instead of a verified token.
- Attack scenario: Attacker connects to socket service and registers another user ID to impersonate them or receive notifications.
- Security impact: User impersonation and unauthorized real-time access.
- Fix implemented: Socket authentication now validates the JWT, loads the user, and binds the socket to the verified user.
- Important before/after code:

Before:
```js
socket.on('register', (userId) => {
  if (userId) {
    registerSocket(userId, socket.id);
  }
});
```

After:
```js
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) {
    return next(new Error('Authentication required'));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select('_id');
  if (!user) return next(new Error('Authentication failed'));

  socket.userId = user._id.toString();
  return next();
});
```

- Testing procedure: Connect without token, with invalid token, and with valid token.
- Before-fix result: Socket registration accepted arbitrary user IDs.
- After-fix result: Only authenticated users can create a socket session.
- Git commit message: `security: authenticate Socket.IO connections using JWT`

### 4.6 Stored XSS through demoUrl / gitRepoUrl
- Vulnerability name: Stored XSS through demoUrl/gitRepoUrl
- OWASP Top 10 category: A03 Injection
- Severity: High
- Exact file path: Backend/src/services/projectService.js, frontend/src/utils/safeUrl.js, frontend/src/components/ProjectCard.jsx, frontend/src/pages/ProjectDetail.jsx, frontend/src/pages/AdminDashboard.jsx
- Function/class: `validateExternalUrl`, `safeExternalUrl`
- Vulnerable implementation: URLs were accepted without strict validation and later rendered into `href` values.
- Why it was vulnerable: Unsafe schemes could be accepted and used in a browser context.
- Attack scenario: Malicious URL is stored and later rendered to a victim user.
- Security impact: Stored XSS and unsafe navigation.
- Fix implemented: Backend validates only `http` and `https`, and frontend strips unsafe URLs before rendering.
- Important before/after code:

Before:
```js
demoUrl: projectData.demoUrl || '',
gitRepoUrl: projectData.gitRepoUrl || '',
```

After:
```js
const validateExternalUrl = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw new Error(`${fieldName} must be a URL`);

  const url = new URL(value.trim());
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('Unsupported URL scheme');
  }
  return url.href;
};
```

Frontend guard:
```js
export const safeExternalUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};
```

- Testing procedure: Submit `javascript:`, `data:`, and valid `https://` values; render project pages and verify only valid URLs remain.
- Before-fix result: Unsafe values were stored and used in rendered links.
- After-fix result: Only secure external links are retained.
- Git commit message: `security: validate project URLs to prevent stored XSS`

### 4.7 Vulnerable Multer Dependency
- Vulnerability name: Vulnerable Multer dependency
- OWASP Top 10 category: A06 Vulnerable and Outdated Components
- Severity: Medium
- Exact file path: Backend/package.json, Backend/src/middlewares/uploadMiddleware.js
- Function/class: `uploadProjectImages`, `fileFilter`
- Vulnerable implementation: Old dependency version and insufficient upload restrictions increased exposure.
- Why it was vulnerable: Uploaded files were processed with a package version that had known concerns and limited validation.
- Attack scenario: Attackers upload non-image or oversized files to trigger resource issues or exploit vulnerable parsing behavior.
- Security impact: File abuse and resource exhaustion.
- Fix implemented: Dependency upgraded and upload restrictions enforced.
- Important before/after code:

Before:
```json
"multer": "^1.x"
```

After:
```json
"multer": "^2.2.0"
```

and:
```js
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});
```

- Testing procedure: Upload valid image, invalid file type, and oversized file.
- Before-fix result: Broader upload surface and weaker safeguards.
- After-fix result: Only image files under 5 MB pass.
- Git commit message: `security: upgrade multer and strengthen upload limits`

### 4.8 Regex / Resource Exhausion Issue
- Vulnerability name: Regex / resource exhaustion issue
- OWASP Top 10 category: A04 Insecure Design
- Severity: Medium
- Exact file path: Backend/src/utils/search.js, Backend/src/services/projectService.js, Backend/src/controllers/userController.js
- Function/class: `createLiteralSearchRegex`
- Vulnerable implementation: Search input was not constrained or escaped properly before building a regex.
- Why it was vulnerable: Long or regex-heavy input could trigger expensive processing or make search resources degrade.
- Attack scenario: An attacker sends long or complex search strings to increase CPU usage.
- Security impact: Resource exhaustion and degraded availability.
- Fix implemented: Escape regex metacharacters, reject empty input, and cap search length.
- Important before/after code:

Before:
```js
return new RegExp(value, 'i');
```

After:
```js
const MAX_SEARCH_TERM_LENGTH = 100;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createLiteralSearchRegex = (value, fieldName = 'Search') => {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be text`);
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) return null;
  if (normalizedValue.length > MAX_SEARCH_TERM_LENGTH) {
    throw new Error(`${fieldName} must not exceed ${MAX_SEARCH_TERM_LENGTH} characters`);
  }

  return new RegExp(escapeRegExp(normalizedValue), 'i');
};
```

- Testing procedure: Submit long input, regex special characters, and normal search strings.
- Before-fix result: Unbounded or malicious patterns could stress the application.
- After-fix result: Search is literal, sanitized, and capped.
- Git commit message: `security: restrict regex input to prevent resource exhaustion`

Status: This was a valid issue in the earlier code path and was fixed in the current version. It does not remain an unresolved issue in the final codebase after runtime review.

---

## 5. Security Testing

| Vulnerability | Test | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|
| Default JWT secret | Start server without or with weak secret | App should refuse to start | Startup fails when secret missing or too short | Pass |
| Reusable invite token | Reuse same invite token for another account | Reject | Email mismatch and single-use token checks block misuse | Pass |
| Private project IDOR | Access private project by ID as unauthorized user | Forbidden | Access denied for non-owner/non-admin | Pass |
| Student approval bypass | Student tries to set `isPublic` in create/update | Ignored | Visibility remains protected behind privileged route | Pass |
| Unauthenticated Socket.IO | Connect without auth or invalid JWT | Fail | Connection rejected by middleware | Pass |
| Stored XSS through URLs | Submit unsafe URL values | Rejected or sanitized | Only http/https URLs remain valid | Pass |
| Vulnerable Multer | Upload invalid file type / oversized file | Fail | File type and size enforcement triggered | Pass |
| Regex DoS risk | Submit long and regex-like search strings | Reject or sanitize | Search term is capped and escaped | Pass |

---

## 6. Security Improvements

### Implemented Controls
- Input validation for project URLs and search terms
- Output validation for external links
- Authorization via role and ownership checks
- JWT validation for API and Socket.IO access
- CORS enforcement
- Secure configuration requirement for JWT
- Upload validation for image type and file size
- Error handling for invalid auth and unauthorized access
- Logging for socket events and server issues
- Cloudinary-backed upload handling instead of local disk storage

### Recommended Future Improvements
- Add Helmet security headers
- Add rate limiting for authentication and API routes
- Add token revocation / logout invalidation strategy
- Add strict HTTPS enforcement in deployment config
- Add stronger audit logging for privileged actions
- Add automated dependency scanning and SCA monitoring
- Add file scanning / content validation for upload files

---

## 7. Challenges Faced
- Enforcing secure defaults without breaking development setup
- Preventing invitation replay while keeping account onboarding functional
- Restricting private project access without breaking legitimate owner/admin flows
- Preserving approval workflow while preventing client-side bypass
- Securing real-time socket access without breaking notifications
- Validating URLs without affecting legitimate demo/project links
- Upgrading the upload stack while retaining serverless-friendly deployment behavior
- Handling regex input safely without reducing search usability

---

## 8. Lessons Learned
- Security should be enforced in the service layer, not only on the route layer
- JWT configuration must be validated at startup and never default to insecure values
- Importantly, short-lived project approval workflows need strong server-side checks
- Real-time services need their own authentication layer
- User-controlled values rendered into the client must always be normalized and validated
- Input validation and output validation both matter; they complement each other
- Dependency hygiene matters and should be part of a regular review process

---

## 9. Git History

Security-related commits in this project:

1. `security: remove default JWT secret and enforce environment configuration`
   - Fixed insecure default JWT secret issue

2. `security: make invitation tokens single-use and bind them to invited email`
   - Fixed replay and email mismatch risk

3. `security: enforce authorization for private project access`
   - Fixed private project IDOR risk

4. `security: prevent students from bypassing project approval workflow`
   - Fixed unauthorized publication workflow bypass

5. `security: authenticate Socket.IO connections using JWT`
   - Fixed unauthenticated socket registration issue

6. `security: validate project URLs to prevent stored XSS`
   - Fixed unsafe external URL handling and XSS path

7. `security: upgrade multer and strengthen upload limits`
   - Fixed vulnerable dependency and upload restrictions

8. `security: restrict regex input to prevent resource exhaustion`
   - Fixed regex/resource-exhaustion risk

---

## 10. Final Security Status

| Vulnerability | OWASP | Severity | Fixed? | How Verified |
|---|---|---|---|---|
| Default / hard-coded JWT secret | A05 Security Misconfiguration | High | Yes | Startup validation, environment template documentation |
| Reusable invitation token / email mismatch | A07 Identification and Authentication Failures | High | Yes | Invitation validation and atomic completion logic |
| Private project IDOR | A01 Broken Access Control | High | Yes | Ownership and access checks in project and interaction services |
| Student project approval bypass | A01 Broken Access Control | High | Yes | Privileged visibility-only update path |
| Unauthenticated Socket.IO registration | A01 Broken Access Control | High | Yes | JWT verification in Socket.IO middleware |
| Stored XSS through demoUrl/gitRepoUrl | A03 Injection | High | Yes | URL validation and frontend sanitization |
| Vulnerable Multer dependency | A06 Vulnerable and Outdated Components | Medium | Yes | Dependency upgrade and upload restrictions |
| Regex / resource exhaustion | A04 Insecure Design | Medium | Yes | Input length cap and regex escaping |

---

## 11. Final Notes

The project underwent a focused security review and remediation pipeline. The most significant issues were around access control, user identity enforcement, and client-controlled data validation. These were handled by enforcing JWT validation, restricting project visibility logic, binding invitations to the correct email, validating all external URLs, and securing upload handling.

This README documents the work completed in the repository and is intended as a technical source for the final university blog and assessment write-up.
