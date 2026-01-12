CityPlus – Smart Civic Issue Reporting Platform

CityPlus is a full-stack web application developed to digitize the process of reporting and managing civic issues such as garbage problems, road damage, water supply issues, and other public infrastructure complaints.

The system allows citizens to submit issues online while administrators and staff can track, manage, and update issue statuses through a centralized dashboard.

This project is developed as a TYBSc IT Final Year Project with a focus on practical full-stack development using real-world technologies.

🎯 Key Features
Citizen Module

User registration and login

Report civic issues

View submitted issue status

Citizen dashboard interface

Admin & Staff Module

Admin and staff authentication

View all reported issues

Update issue status (Pending / In Progress / Resolved)

Dedicated dashboards for admin and staff

🏗️ Project Architecture (ACTUAL STRUCTURE)

The project follows a monorepo structure, with backend and frontend maintained in separate folders under one repository.

Cityplus Testing/
├── backend/
│   ├── config/
│   │   └── db.js                # Database connection
│   │
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   └── issueController.js
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── errorMiddleware.js
│   │
│   ├── models/
│   │   ├── Issue.js
│   │   └── User.js
│   │
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   └── issueRoutes.js
│   │
│   ├── .env                     # Environment variables (ignored)
│   ├── package.json
│   ├── package-lock.json
│   └── server.js                # Backend entry point
│
├── frontend/
│   ├── css/
│   │   └── styles.css
│   │
│   ├── js/
│   │   ├── admin-dashboard.js
│   │   ├── auth.js
│   │   ├── citizen-dashboard.js
│   │   ├── issue.js
│   │   ├── staff-dashboard.js
│   │   └── theme.js
│   │
│   ├── index.html
│   ├── login.html
│   ├── report-issue.html
│   ├── citizen-dashboard.html
│   ├── admin-dashboard.html
│   └── staff-dashboard.html
│
├── .gitignore
├── package.json                 # Root dependencies
└── README.md

🛠️ Technology Stack (NO EXAGGERATION)
Backend

Node.js

Express.js

MongoDB

Mongoose

JSON Web Tokens (JWT)

RESTful APIs

Frontend

HTML5

CSS3

Vanilla JavaScript

Tools

Git & GitHub

Visual Studio Code

Postman (API testing)

⚙️ Installation & Setup
Prerequisites

Node.js installed

MongoDB (local or cloud)

Git installed

Backend Setup
cd backend
npm install


Create a .env file inside the backend folder:

PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key


Run backend server:

npm start

Frontend Setup

No build tools are required.

Open any of the following files in a browser:

index.html

login.html

citizen-dashboard.html

admin-dashboard.html

staff-dashboard.html

Frontend communicates with backend APIs using JavaScript.

🔐 Security Practices

.env files are ignored using .gitignore

Sensitive credentials are never pushed to GitHub

JWT-based authentication is used for protected routes

🔌 Backend API Overview
Method	Endpoint	Description
POST	/api/auth/register	Register new user
POST	/api/auth/login	User login
POST	/api/issues	Report civic issue
GET	/api/issues	Get all issues
PUT	/api/issues/:id	Update issue status
🎓 Academic Objective

This project demonstrates:

Full-stack application development

MVC-based backend architecture

REST API design

Authentication & authorization

Practical problem-solving using web technologies

👤 Author

Bipin
TYBSc IT – Final Year Student
Project developed individually.

📄 License

This project is developed for educational purposes only.