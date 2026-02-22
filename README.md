<div align="center">
  <h1>🏙️ CityPlus</h1>
  <p><strong>Smart Civic Issue Reporting Platform</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
    <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
    <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
    <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  </p>
</div>

<br />

## 📖 About The Project

**CityPlus** is a full-stack web application designed to digitize the process of reporting and managing civic issues. From garbage problems and road damage to water supply issues and public infrastructure complaints, CityPlus empowers citizens to make their voices heard. 

The system provides a seamless online submission portal for citizens, while equipping administrators and staff with a centralized dashboard to track, manage, and update issue statuses efficiently.

> **Note:** This project was developed as a TYBSc IT Final Year Project, focusing on practical full-stack development using real-world technologies.

---

## ✨ Key Features

### 👤 Citizen Module
- **Authentication**: Secure user registration and login.
- **Reporting**: Easily report civic issues with relevant details.
- **Tracking**: View real-time status updates of submitted issues.
- **Dashboard**: A clean, intuitive citizen dashboard interface.

### 🛡️ Admin & Staff Module
- **Secure Access**: Dedicated admin and staff authentication.
- **Issue Management**: View and filter all reported issues.
- **Status Updates**: Modify issue status seamlessly (`Pending` ➜ `In Progress` ➜ `Resolved`).
- **Dedicated Dashboards**: Tailored views for both admin and staff roles.

---

## 🏗️ Project Architecture

The project follows a streamlined monorepo structure, cleanly separating the backend API and frontend interfaces.

```text
Cityplus Testing/
├── backend/                  # Node.js & Express API
│   ├── config/               # Database configuration
│   ├── controllers/          # Business logic handlers
│   ├── middleware/           # Auth and error middlewares
│   ├── models/               # Mongoose schemas (User, Issue)
│   ├── routes/               # Express route definitions
│   └── server.js             # Application entry point
│
└── frontend/                 # Vanilla web client UI
    ├── css/                  # Stylesheets
    ├── js/                   # Client-side logic & API calls
    └── *.html                # Views (Dashboards, Login, etc.)
```

---

## 🚀 Getting Started

Follow these instructions to set up the project locally.

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v14 or higher)
- [MongoDB](https://www.mongodb.com/) (Local instance or Cloud Atlas URI)
- [Git](https://git-scm.com/)

### 🛠️ Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the `backend` directory and add your configuration:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_super_secret_key
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   # or
   npm start
   ```

### 🖥️ Frontend Setup

The frontend is built with vanilla web technologies, meaning **no build step is required**.

1. Simply open the HTML files directly in your preferred web browser:
   - `frontend/index.html` (Landing Page)
   - `frontend/login.html` (Authentication)

*Tip: For the best experience, use a local server extension like **Live Server** in Visual Studio Code.*

---

## 🔌 API Reference

The backend exposes a RESTful API for client consumption:

| HTTP Method | Endpoint               | Description                 | Auth Required |
| :---        | :---                   | :---                        | :---:         |
| `POST`      | `/api/auth/register`   | Register a new user         | ❌            |
| `POST`      | `/api/auth/login`      | Authenticate user & get JWT | ❌            |
| `POST`      | `/api/issues`          | Report a new civic issue    | ✅            |
| `GET`       | `/api/issues`          | Retrieve all issues         | ✅            |
| `PUT`       | `/api/issues/:id`      | Update issue status         | ✅ (Admin/Staff)|

---

## 🔐 Security & Best Practices

- **Environment Isolation**: Sensitive credentials and API keys are stored in `.env` and kept safely out of version control via `.gitignore`.
- **Stateless Authentication**: Protected API routes require JSON Web Tokens (JWT) passed securely via the authorization header.
- **MVC Architecture**: Codebase is structured following the Model-View-Controller pattern for maximum maintainability.

---

## 🎓 Academic Objective

This project successfully demonstrates:
- Full-stack web application development from scratch.
- Implementation of an MVC-based Node.js backend architecture.
- RESTful API design, construction, and consumption.
- Secure, token-based user authentication and authorization.
- Practical problem-solving for real-world scenarios using modern web technologies.

---

## 👨‍💻 Author

**Bipin**  
*TYBSc IT – Final Year Student*  
Project developed individually.

---

<div align="center">
  <p><i>Developed for educational purposes.</i></p>
</div>