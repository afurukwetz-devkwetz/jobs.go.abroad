# COS Nurses Professional Registration Portal

A fully decoupled, full-stack application designed to handle professional registrations, applicant tracking, and secure administrative management.

## 🌟 Features

- **Client Registration Form**: A premium, responsive UI for nurses, caregivers, and other professionals to register and upload their CVs.
- **Applicant Tracking**: Applicants can use their unique Reference Number or Email to track the live status of their application.
- **Secure Admin Dashboard**: A protected dashboard utilizing JWT authentication for administrators to view applicants, download CVs, and update application statuses (Pending, Approved, Rejected).
- **Automated Batching**: The backend automatically groups applicants into manageable batches based on their profession.

---

## 🏗️ Architecture

The application is decoupled into three parts for easy deployment and scaling:
1. **Backend API (Node.js/Express)**: Handles database connections, authentication, and logic.
2. **Client Frontend (HTML/CSS/JS)**: The user-facing application.
3. **Admin Frontend (HTML/CSS/JS)**: The secure administrative portal.

---

## 💻 Local Development

### Prerequisites
- Node.js installed
- MongoDB installed and running locally (or a MongoDB Atlas connection string)

### Setup
1. Clone the repository and navigate to the project folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory based on the following template:
   ```env
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/cosnurses
   JWT_SECRET=your_super_secret_jwt_key
   BATCH_SIZE=20
   ADMIN_EMAIL=admin@cosnurses.com
   ADMIN_PASSWORD=admin123
   ```
4. Start the backend server:
   ```bash
   npm start
   ```
5. Open `index.html` in your browser (or use an extension like VS Code Live Server) to view the client app. Open `admin.html` to access the dashboard.

*(Note: In local development, the `config.js` file should point to `http://localhost:3000`)*

---

## 🚀 Deployment Guide (Render)

Because the application is decoupled, you will deploy it as three separate services on Render.

### 1. Deploy the Backend API
1. In Render, create a **New Web Service**.
2. Connect this repository.
3. Settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add all your `.env` variables in the **Environment Variables** section.
5. Deploy the service and **copy the generated live URL** (e.g., `https://cosnurses-api.onrender.com`).

### 2. Update Configuration
Before deploying the frontends, open `config.js` and replace `http://localhost:3000` with your new live backend URL. **Commit and push this change to GitHub.**

### 3. Deploy the Client Dashboard
1. In Render, create a **New Static Site**.
2. Connect this repository.
3. Settings:
   - **Build Command**: *(leave blank)*
   - **Publish Directory**: `.`
4. Deploy the site.

### 4. Deploy the Admin Dashboard
1. In Render, create another **New Static Site**.
2. Connect the same repository.
3. Settings:
   - **Build Command**: *(leave blank)*
   - **Publish Directory**: `.`
4. Once created, go to the **Redirects/Rewrites** settings for this site.
5. Add the following rule to ensure the admin page loads:
   - **Source**: `/*`
   - **Destination**: `/admin.html`
   - **Action**: `Rewrite`
6. Save the rule. Your secure admin portal is now live!
