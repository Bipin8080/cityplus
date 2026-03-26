# CityPlus 🏙️

**Smart Civic Issue Reporting Platform**

CityPlus is a full-stack civic issue reporting web application that enables citizens to report municipal issues (potholes, streetlight outages, garbage, etc.) and allows municipal staff and administrators to track, assign, and resolve them efficiently.

---

## ✨ Features

### For Citizens
- **Report Issues** — Submit civic issues with photo uploads and map-based location tagging
- **Track Issues** — View status updates on reported issues in real-time
- **Feedback** — Provide feedback on resolved issues
- **Anonymous Reporting** — Submit issues without creating an account
- **Notifications** — Receive real-time and email notifications on issue status changes

### For Staff
- **Assigned Issues** — View and manage issues assigned to their department
- **Status Updates** — Update issue status with proof images (In Progress → Resolved)
- **Reject Requests** — Request admin approval to reject invalid issues

### For Admins
- **Dashboard Analytics** — Overview cards with live counts and statistics
- **Issue Management** — View, filter, assign, soft-delete, and restore issues
- **Staff Management** — Register staff accounts, assign departments, activate/block users
- **Department Management** — Create, edit, and delete departments
- **User Management** — Manage all citizen, staff, and admin accounts
- **CSV Export** — Export filtered issues to CSV for offline analysis

### Platform-Wide
- 🔔 **Real-Time Notifications** via Socket.IO
- 📧 **Email Notifications** with styled HTML templates (OTP, status updates, assignments)
- 🌗 **Dark/Light Theme** toggle with persistence
- 📱 **PWA Support** — installable on mobile devices with offline caching
- 🔒 **Role-Based Access Control** — citizen, staff, admin
- 🗺️ **Map Integration** — Mappls/Google Maps for issue location

---

## 🛠️ Tech Stack

| Layer       | Technology                                              |
|-------------|--------------------------------------------------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript, Material Icons       |
| **Backend**  | Node.js, Express.js (ES Modules)                      |
| **Database** | MongoDB Atlas, Mongoose ODM                           |
| **Auth**     | JWT (JSON Web Tokens), bcryptjs                       |
| **File Upload** | Cloudinary + Multer                                |
| **Real-Time** | Socket.IO                                            |
| **Email**    | Nodemailer (Gmail SMTP)                               |
| **Security** | express-rate-limit, express-mongo-sanitize, CORS      |
| **Dev Tools** | Nodemon, custom lint script                          |

---

## 📁 Project Structure

```text
cityplus/
├── backend/
│   ├── config/
│   │   ├── cloudinary.js      # Cloudinary SDK setup
│   │   ├── db.js              # MongoDB connection
│   │   ├── email.js           # Nodemailer transporter
│   │   └── socket.js          # Socket.IO initialization & events
│   ├── controllers/
│   │   ├── adminController.js     # Dashboard summary, user management
│   │   ├── authController.js      # Register, login, OTP, password reset
│   │   ├── departmentController.js # CRUD for departments
│   │   ├── issueController.js     # Issue CRUD, assignment, export
│   │   └── notificationController.js # Notification list, read, count
│   ├── middleware/
│   │   ├── authMiddleware.js  # JWT verification, role guards
│   │   └── errorMiddleware.js # Centralized error handler
│   ├── models/
│   │   ├── Department.js      # Department schema
│   │   ├── Issue.js           # Issue schema (status, location, images)
│   │   ├── Notification.js    # In-app notification schema
│   │   ├── OTP.js             # OTP storage with expiry
│   │   └── User.js            # User schema (citizen/staff/admin)
│   ├── routes/
│   │   ├── adminRoutes.js     # /api/admin/*
│   │   ├── authRoutes.js      # /api/auth/*
│   │   ├── configRoutes.js    # /api/config/*
│   │   ├── departmentRoutes.js # /api/departments/*
│   │   ├── issueRoutes.js     # /api/issues/*
│   │   └── notificationRoutes.js # /api/notifications/*
│   ├── scripts/               # Lint and utility scripts
│   ├── tests/                 # Automated security tests
│   ├── utils/
│   │   ├── emailTemplates.js  # Styled HTML email templates
│   │   ├── issueAccess.js     # Role-based issue access checks
│   │   └── response.js        # Standardized API response helpers
│   └── server.js              # Express app entry point
├── frontend/
│   ├── css/
│   │   └── styles.css         # All application styles
│   ├── js/
│   │   ├── admin-dashboard.js # Admin panel logic
│   │   ├── api.js             # API helper (fetch wrapper with auth)
│   │   ├── auth.js            # Login & registration logic
│   │   ├── citizen-dashboard.js # Citizen panel logic
│   │   ├── issue.js           # Report-issue form with map
│   │   ├── landing.js         # Public landing page
│   │   ├── main.js            # Shared bootstrap
│   │   ├── notifications.js   # Bell icon, notification panel
│   │   ├── staff-dashboard.js # Staff panel logic
│   │   ├── staff-setup.js     # First-time staff password setup
│   │   └── theme.js           # Dark/light theme & toast system
│   ├── admin-dashboard.html
│   ├── citizen-dashboard.html
│   ├── index.html             # Landing / public issue feed
│   ├── login.html             # Login & registration page
│   ├── report-issue.html      # Issue submission form
│   ├── staff-dashboard.html
│   ├── staff-setup.html       # Staff first-login setup
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker for offline caching
└── package.json               # Root scripts (dev, lint, test)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ and **npm**
- **MongoDB Atlas** account (or a local MongoDB instance)
- **Cloudinary** account (for image uploads)
- **Gmail** account with App Password (for email notifications)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Bipin8080/cityplus.git
   cd cityplus
   ```

2. **Install dependencies:**
   ```bash
   npm install
   npm --prefix backend install
   ```

3. **Configure environment variables:**

   Create `backend/.env` with the following:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret

   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   EMAIL_FROM="CityPlus" <your_email@gmail.com>

   FRONTEND_URL=http://localhost:5000
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   ```
   http://localhost:5000
   ```

> The backend serves the frontend statically, so a single `npm run dev` is all you need.

---

## 📜 Available Scripts

| Command         | Description                              |
|-----------------|------------------------------------------|
| `npm run dev`   | Start dev server with hot-reload (nodemon) |
| `npm start`     | Start production server                  |
| `npm run lint`  | Run the custom linter                    |
| `npm test`      | Run automated security tests             |

---

## 🔌 API Reference

### Authentication — `/api/auth`

| Method | Endpoint                    | Access  | Description                    |
|--------|-----------------------------|---------|--------------------------------|
| POST   | `/register`                 | Public  | Citizen self-registration      |
| POST   | `/register/verify-otp`      | Public  | Verify registration OTP        |
| POST   | `/register/resend-otp`      | Public  | Resend registration OTP        |
| POST   | `/login`                    | Public  | Login (all roles)              |
| POST   | `/forgot-password`          | Public  | Send password-reset OTP        |
| POST   | `/verify-otp`               | Public  | Verify password-reset OTP      |
| POST   | `/reset-password`           | Public  | Reset password with OTP        |
| POST   | `/complete-staff-setup`     | Public  | Staff first-login setup        |
| POST   | `/send-change-password-otp` | Auth    | Request change-password OTP    |
| POST   | `/change-password`          | Auth    | Change password                |
| PATCH  | `/email-notifications`      | Auth    | Toggle email notification pref |
| POST   | `/register-staff`           | Admin   | Register new staff member      |
| POST   | `/register-admin`           | Admin   | Register new admin             |

### Issues — `/api/issues`

| Method | Endpoint              | Access      | Description                         |
|--------|-----------------------|-------------|-------------------------------------|
| GET    | `/`                   | Public      | Public issue feed (landing page)    |
| POST   | `/`                   | Public/Auth | Create issue (with image upload)    |
| GET    | `/my`                 | Citizen     | List citizen's own issues           |
| GET    | `/all`                | Auth        | All issues with filters & pagination|
| GET    | `/export`             | Admin       | Export issues as CSV                |
| GET    | `/assigned/mine`      | Staff       | Staff's assigned issues             |
| PATCH  | `/:id/status`         | Staff/Admin | Update issue status                 |
| POST   | `/:id/reject-request` | Staff       | Request rejection approval          |
| PATCH  | `/:id/assign`         | Admin       | Assign staff to issue               |
| PATCH  | `/:id/reject`         | Admin       | Reject an issue                     |
| DELETE | `/:id`                | Admin       | Soft-delete an issue                |
| PATCH  | `/:id/restore`        | Admin       | Restore soft-deleted issue          |
| GET    | `/:id`                | Auth        | Get single issue details            |
| POST   | `/:id/feedback`       | Citizen     | Add feedback to resolved issue      |

### Admin — `/api/admin`

| Method | Endpoint                      | Access | Description                      |
|--------|-------------------------------|--------|----------------------------------|
| GET    | `/summary`                    | Admin  | Dashboard summary counts         |
| GET    | `/users`                      | Admin  | List all users                   |
| GET    | `/staff`                      | Admin  | List staff for dropdowns         |
| PATCH  | `/users/:userId/status`       | Admin  | Update user status               |
| PATCH  | `/staff/:staffId/department`  | Admin  | Assign department to staff       |

### Departments — `/api/departments`

| Method | Endpoint   | Access | Description        |
|--------|------------|--------|--------------------|
| GET    | `/`        | Public | List departments   |
| POST   | `/`        | Admin  | Create department  |
| PUT    | `/:id`     | Admin  | Update department  |
| DELETE | `/:id`     | Admin  | Delete department  |

### Notifications — `/api/notifications`

| Method | Endpoint        | Access | Description            |
|--------|-----------------|--------|------------------------|
| GET    | `/`             | Auth   | List latest 50         |
| GET    | `/unread-count` | Auth   | Unread badge count     |
| PATCH  | `/read-all`     | Auth   | Mark all as read       |
| PATCH  | `/:id/read`     | Auth   | Mark one as read       |

### Config — `/api/config`

| Method | Endpoint    | Access | Description               |
|--------|-------------|--------|---------------------------|
| GET    | `/maps-key` | Public | Get maps API key          |

---

## 🔐 Security

- **JWT Authentication** — Stateless token-based auth with role claims
- **Password Hashing** — bcryptjs with salt rounds
- **Rate Limiting** — 20 requests per 15 min on auth endpoints
- **NoSQL Injection Prevention** — express-mongo-sanitize
- **CORS** — Configurable origin whitelist
- **Input Validation** — Server-side validation on all endpoints
- **OTP Verification** — Email-based OTP for registration and password reset
- **Role-Based Access** — Middleware guards on all protected routes

---

## 👥 User Roles

| Role      | Capabilities                                                         |
|-----------|----------------------------------------------------------------------|
| **Citizen** | Report issues, track own issues, provide feedback, manage profile  |
| **Staff**   | View assigned issues, update status, request rejections            |
| **Admin**   | Full access: manage users, issues, departments, analytics, exports |

---

## 📄 License

ISC

---

## 👤 Author

**Bipin**
