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
    <img src="https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white" alt="Cloudinary" />
  </p>
</div>

<br />

## 📖 About The Project

**CityPlus** is a full-stack web application designed to digitize the process of reporting and managing civic issues. From garbage accumulation and road potholes to water supply leakage and infrastructure complaints, CityPlus empowers citizens to easily voice their concerns. 

The system provides a seamless online submission portal for citizens, while equipping administrators and municipal staff with a centralized, role-based dashboard to track, manage, and update issue statuses efficiently. The primary focus of this project is to provide a smooth, resilient, and actionable incident reporting workflow.

> **Note:** This project was developed as a TYBSc IT Final Year Project, focusing on practical full-stack development using real-world technologies.

---

## ✨ Key Features & Enhancements

### 👤 Citizen Module
- **Authentication**: Secure user registration and login functionality.
- **Issue Reporting**: Users can seamlessly report civic issues with relevant details, categorize the incident by type, and upload images as tangible evidence.
- **Real-Time Tracking**: Citizens have a dedicated dashboard to view all their submitted reports and track progressive resolution statuses in real-time.
- **Modern User Interface**: A clean, intuitive dashboard interface with persistent Dark/Light mode theme selections, collapsible sidebar navigation, and fluid responsive styling.

### 🛡️ Admin & Staff Module
- **Role-Based Access Control**: Dedicated, secure authentication portals separating Admin and Staff tier users.
- **Centralized Issue Management**: View, filter, and manage all comprehensively reported issues. The application features "Fetch Latest" capabilities to retrieve data updates without jarring page reloads.
- **Regulated Workflow**: Clear operational workflow to modify an issue's status securely via role boundaries (`Pending` ➜ `Assigned` ➜ `In Progress` ➜ `Resolved`).
- **Dedicated Dashboards**: Tailored views featuring functional statistical overview cards and dynamic, responsive layouts matching user roles.

### ⚙️ System & Technical Integrations
- **Cloud Media Storage**: Formally integrated with **Cloudinary** for scalable, secure image hosting. This system replaces standard local file storage, ensuring evidence persistence and improving server processing capabilities.
- **Dynamic UI/UX Improvements**: Interactive hover animations, integrated modal popups, toast notifications for direct action feedback, and a design scaled effectively for diverse screen sizes.

---

## 🏗️ Project Architecture

The codebase follows a streamlined structural pattern, cleanly separating the backend REST API core from the client-side frontend interfaces.

```text
Cityplus/
├── backend/                  # Node.js & Express API
│   ├── config/               # Database & Cloudinary configurations
│   ├── controllers/          # Business logic handlers
│   ├── middleware/           # Auth (JWT) and error middlewares
│   ├── models/               # Mongoose schemas (User, Issue)
│   ├── routes/               # Express route definitions
│   └── server.js             # Application entry point
│
└── frontend/                 # Vanilla web client UI
    ├── css/                  # Stylesheets & cascading themes
    ├── js/                   # Client-side logic & API integration
    └── *.html                # Views (Dashboards, Login, Landing Page)
```

---

## 🚀 Getting Started

Follow these instructions to set up the project locally on your machine.

### Prerequisites

Ensure you have the following services installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- [MongoDB](https://www.mongodb.com/) (Local instance or Cloud Atlas URI)
- **Cloudinary Account**: Required for resolving application image uploads.

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
   Create a `.env` file within the `backend` directory and add your localized configurations:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_super_secret_key
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   # or
   npm start
   ```

### 🖥️ Frontend Setup

The frontend is built efficiently with vanilla web technologies, meaning **no build step is explicitly required**.

1. Simply open the HTML files directly in your preferred web browser:
   - `frontend/index.html` (Landing Page)
   - `frontend/login.html` (Authentication)

*Tip: For the best development experience seamlessly handling local route requests, use a local server extension like **Live Server** in Visual Studio Code to serve the frontend directory.*

---

## 🔌 API Reference

The backend exposes a well-defined RESTful API for client consumption:

| HTTP Method | Endpoint               | Description                 | Auth Required |
| :---        | :---                   | :---                        | :---:         |
| `POST`      | `/api/auth/register`   | Register a new user         | ❌            |
| `POST`      | `/api/auth/login`      | Authenticate user & get JWT | ❌            |
| `POST`      | `/api/issues`          | Report a new civic issue    | ✅            |
| `GET`       | `/api/issues`          | Retrieve all issues         | ✅            |
| `PUT`       | `/api/issues/:id`      | Update issue status         | ✅ (Admin/Staff)|

---

## 🔐 Security & Best Practices

- **Scalable Media Management**: Migrated reporting media logic to Cloudinary to handle assets efficiently, avoiding local server bloat and ensuring high cloud availability.
- **Environment Isolation**: Sensitive credentials, database URIs, and API keys are stored in a `.env` file kept safely out of version control systems via `.gitignore`.
- **Stateless Authentication**: Protected API routes universally mandate JSON Web Tokens (JWT) passed securely via the HTTP authorization header protocols.
- **MVC Architecture Pattern**: The server-side codebase is uniformly structured following the Model-View-Controller framework paradigm for robust long-term maintainability.

---

## 🎓 Academic Objective

This capstone project successfully demonstrates:
- Full-stack web application engineering originating from scratch.
- Implementation of a resilient MVC-based Node.js backend infrastructure.
- Complete RESTful API schema design, construction, and client-side consumption.
- Securely tiered token-based user authentication and strict data authorization.
- Third-party Software-as-a-Service integration (Cloudinary).
- Advanced vanilla DOM manipulation, handling complex cross-role application structural workflows, and assembling natively responsive user interfaces.

---

## 👨‍💻 Author

**Bipin**  
*TYBSc IT – Final Year Student*  
Project developed individually.

---

<div align="center">
  <p><i>Developed for educational conceptualization. Not affiliated with any operating municipal authority or civic board.</i></p>
</div>