import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/login";
import ManagerRegister from "./pages/managerRegister";
import ChangePassword from "./pages/ChangePassword";
import StudentDashboard from "./pages/StudentDashboard";
import StaffDashboard from "./pages/StaffDashboard";

import ManagerProtectedRoute from "./components/ManagerProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";

import { ManagerProvider } from "./context/ManagerContext";

import ManagerLayout from "./components/manager/ManagerLayout";

import Overview from "./pages/manager/Overview";
import Students from "./pages/manager/Students";
import MessUnits from "./pages/manager/MessUnits";
import MenuManagement from "./pages/manager/MenuManagement";
import HostelDetails from "./pages/manager/HostelDetails";
import Forecasts from "./pages/manager/Forecasts";
import Reports from "./pages/manager/Reports";
import Staff from "./pages/manager/Staff";
import Settings from "./pages/manager/Settings";
import ManagerProfile from "./pages/manager/ManagerProfile";


function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =========================================
            DEFAULT
        ========================================= */}

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />


        {/* =========================================
            AUTHENTICATION
        ========================================= */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/manager-register"
          element={<ManagerRegister />}
        />

        <Route
          path="/change-password"
          element={<ChangePassword />}
        />


        {/* =========================================
            MANAGER
        ========================================= */}

        <Route
          path="/manager/dashboard"
          element={
            <ManagerProtectedRoute>
              <ManagerProvider>
                <ManagerLayout />
              </ManagerProvider>
            </ManagerProtectedRoute>
          }
        >

          {/* OVERVIEW */}

          <Route
            index
            element={<Overview />}
          />


          {/* STUDENTS */}

          <Route
            path="students"
            element={<Students />}
          />


          {/* MESS UNITS */}

          <Route
            path="mess-units"
            element={<MessUnits />}
          />


          {/* MENU MANAGEMENT */}

          <Route
            path="menu-management"
            element={<MenuManagement />}
          />


          {/* HOSTEL DETAILS */}

          <Route
            path="hostels"
            element={<HostelDetails />}
          />


          {/* FORECASTS */}

          <Route
            path="forecasts"
            element={<Forecasts />}
          />


          {/* REPORTS */}

          <Route
            path="reports"
            element={<Reports />}
          />


          {/* STAFF */}

          <Route
            path="staff"
            element={<Staff />}
          />


          {/* SETTINGS */}

          <Route
            path="settings"
            element={<Settings />}
          />


          {/* MANAGER PROFILE */}

          <Route
            path="profile"
            element={<ManagerProfile />}
          />

        </Route>


        {/* =========================================
            STUDENT
        ========================================= */}

        <Route
          path="/student/dashboard"
          element={
            <RoleProtectedRoute
              requiredRole="student"
            >
              <StudentDashboard />
            </RoleProtectedRoute>
          }
        />


        {/* =========================================
            STAFF
        ========================================= */}

        <Route
          path="/staff/dashboard"
          element={
            <RoleProtectedRoute
              requiredRole="staff"
            >
              <StaffDashboard />
            </RoleProtectedRoute>
          }
        />


        {/* =========================================
            UNKNOWN URL
        ========================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}


export default App;