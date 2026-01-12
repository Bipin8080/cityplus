# CityPlus – Smart Civic Issue Reporting Platform

CityPlus is a comprehensive full-stack web application designed to digitize the process of reporting and managing civic issues, such as garbage problems, road damage, water supply issues, and other public infrastructure complaints. The platform empowers citizens to submit issues online while providing administrators and staff with centralized dashboards to track, manage, and resolve these issues efficiently.

This project was developed as a TYBSc IT Final Year Project, focusing on practical full-stack development using real-world technologies.

---

## 🎯 Key Features

### Citizen Module
- **User Registration and Login**: Secure authentication for citizens.
- **Report Civic Issues**: Submit detailed complaints with descriptions and attachments.
- **Track Issue Status**: View the progress of submitted issues.
- **Citizen Dashboard**: A user-friendly interface for managing reports.

### Admin & Staff Module
- **Authentication**: Secure login for administrators and staff.
- **Manage Issues**: View, update, and resolve reported issues.
- **Role-Based Dashboards**: Dedicated interfaces for administrators and staff.

---

## 🏗️ Project Architecture

The project follows a monorepo structure, with the backend and frontend maintained in separate folders under one repository:

```
Cityplus Testing/
├── backend/
│   ├── config/
│   │   └── db.js                # Database connection
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   └── issueController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── errorMiddleware.js
│   ├── models/
│   │   ├── Issue.js
│   │   └── User.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   └── issueRoutes.js
│   ├── .env                     # Environment variables (ignored)
│   ├── package.json
│   ├── package-lock.json
│   └── server.js                # Backend entry point
├── frontend/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── admin-dashboard.js
│   │   ├── auth.js
│   │   ├── citizen-dashboard.js
│   │   ├── issue.js
│   │   ├── staff-dashboard.js
│   │   └── theme.js
│   ├── index.html
│   ├── login.html
│   ├── report-issue.html
│   ├── citizen-dashboard.html
│   ├── admin-dashboard.html
│   └── staff-dashboard.html
├── .gitignore
├── package.json                 # Root dependencies
└── README.md
```

---

## 🛠️ Technology Stack

### Backend
- **Node.js**: JavaScript runtime for building scalable server-side applications.
- **Express.js**: Web framework for creating RESTful APIs.
- **MongoDB**: NoSQL database for storing application data.
- **Mongoose**: ODM for MongoDB.
- **JSON Web Tokens (JWT)**: Secure authentication and authorization.

### Frontend
- **HTML5**: Markup language for structuring web content.
- **CSS3**: Styling for a responsive and visually appealing interface.
- **Vanilla JavaScript**: Client-side interactivity and API integration.

### Tools
- **Git & GitHub**: Version control and collaboration.
- **Visual Studio Code**: Code editor.
- **Postman**: API testing and debugging.

---

## ⚙️ Installation & Setup

### Prerequisites
- **Node.js** installed
- **MongoDB** (local or cloud instance)
- **Git** installed

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file inside the `backend` folder with the following variables:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_secret_key
   ```

4. Start the backend server:
   ```bash
   npm start
   ```

### Frontend Setup

No build tools are required. Open any of the following files in a browser:
- `index.html`
- `login.html`
- `citizen-dashboard.html`
- `admin-dashboard.html`
- `staff-dashboard.html`

The frontend communicates with backend APIs using JavaScript.

---

## 🔐 Security Practices

- `.env` files are ignored using `.gitignore`.
- Sensitive credentials are never pushed to GitHub.
- JWT-based authentication is implemented for protected routes.

---

## 🔌 Backend API Overview

| Method | Endpoint           | Description                |
|--------|--------------------|----------------------------|
| POST   | `/api/auth/register` | Register new user          |
| POST   | `/api/auth/login`    | User login                 |
| POST   | `/api/issues`        | Report civic issue         |
| GET    | `/api/issues`        | Get all issues             |
| PUT    | `/api/issues/:id`    | Update issue status        |

---

## 🎓 Academic Objective

This project demonstrates:
- Full-stack application development
- MVC-based backend architecture
- REST API design
- Authentication & authorization
- Practical problem-solving using web technologies

---

## 👤 Author

**Bipin**  
TYBSc IT – Final Year Student  
Project developed individually.

---

## 📄 License

This project is developed for educational purposes only.