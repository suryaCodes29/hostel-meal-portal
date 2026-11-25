import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

/* =========================================================
   AUTHENTICATION
========================================================= */

import Login from "./pages/login";
import ManagerRegister from "./pages/managerRegister";
import ChangePassword from "./pages/ChangePassword";


/* =========================================================
   COMMON PROTECTED ROUTE
========================================================= */

import ManagerProtectedRoute from "./components/ManagerProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";


/* =========================================================
   MANAGER CONTEXT
========================================================= */

import { ManagerProvider } from "./context/ManagerContext";


/* =========================================================
   STUDENT CONTEXT
========================================================= */

import { StudentProvider } from "./context/StudentContext";


/* =========================================================
   MANAGER LAYOUT
========================================================= */

import ManagerLayout from "./components/manager/ManagerLayout";


/* =========================================================
   MANAGER PAGES
========================================================= */

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

// Manager communication pages
import ManagerFeedback from "./pages/manager/ManagerFeedback";
import ManagerAnnouncements from "./pages/manager/ManagerAnnouncements";
/* =========================================================
   STAFF
========================================================= */

import StaffDashboard from "./pages/StaffDashboard";
import StaffLayout from "./components/staff/StaffLayout";
import QRScanner from "./pages/staff/QRScanner";
import MealAttendance from "./pages/staff/MealAttendance";
import StudentResponses from "./pages/staff/StudentResponses";
import AttendanceHistory from "./pages/staff/AttendanceHistory";
import StaffAnnouncements from "./pages/staff/Announcements";
import StaffProfile from "./pages/staff/Profile";
import StaffSettings from "./pages/staff/Settings";
import StaffNotifications from "./pages/staff/Notifications";


/* =========================================================
   STUDENT
========================================================= */

import StudentDashboard from "./pages/StudentDashboard";
import StudentLayout from "./components/student/StudentLayout";
import MyMeals from "./pages/student/MyMeals";
import MenuCalendar from "./pages/student/MenuCalendar";
import Responses from "./pages/student/Responses";
import MealHistory from "./pages/student/MealHistory";
import Feedback from "./pages/student/Feedback";
import Announcements from "./pages/student/Announcements";
import StudentProfile from "./pages/student/Profile";
import StudentSettings from "./pages/student/Settings";


/* =========================================================
   APP
========================================================= */

function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* =====================================================
            ROOT
        ===================================================== */}

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />


        {/* =====================================================
            LOGIN
        ===================================================== */}

        <Route
          path="/login"
          element={
            <Login />
          }
        />


        {/* =====================================================
            MANAGER REGISTRATION
        ===================================================== */}

        <Route
          path="/manager-register"
          element={
            <ManagerRegister />
          }
        />


        {/* =====================================================
            CHANGE PASSWORD
        ===================================================== */}

        <Route
          path="/change-password"
          element={
            <ChangePassword />
          }
        />


        {/* =====================================================
            MANAGER
        ===================================================== */}

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

          {/* Manager Dashboard */}

          <Route
            index
            element={
              <Overview />
            }
          />


          {/* Students */}

          <Route
            path="students"
            element={
              <Students />
            }
          />


          {/* Mess Units */}

          <Route
            path="mess-units"
            element={
              <MessUnits />
            }
          />


          {/* Menu Management */}

          <Route
            path="menu-management"
            element={
              <MenuManagement />
            }
          />


          {/* Hostels */}

          <Route
            path="hostels"
            element={
              <HostelDetails />
            }
          />


          {/* Forecasts */}

          <Route
            path="forecasts"
            element={
              <Forecasts />
            }
          />


          {/* Reports */}

          <Route
            path="reports"
            element={
              <Reports />
            }
          />


          {/* Staff */}

          <Route
            path="staff"
            element={
              <Staff />
            }
          />
          {/* Manager Feedback */}

          <Route
            path="feedback"
            element={
              <ManagerFeedback />
            }
          />

          {/* Manager Announcements */}

          <Route
            path="announcements"
            element={
              <ManagerAnnouncements />
            }
          />


          {/* Manager Settings */}

          <Route
            path="settings"
            element={
              <Settings />
            }
          />


          {/* Manager Profile */}

          <Route
            path="profile"
            element={
              <ManagerProfile />
            }
          />
          {/* Student Feedback */}

          <Route
            path="feedback"
            element={
              <ManagerFeedback />
            }
          />
          </Route>


        {/* =====================================================
            STUDENT DASHBOARD
        ===================================================== */}

{/* STUDENT PORTAL — SHARED PROTECTED LAYOUT */}

<Route
  path="/student/dashboard"
  element={
    <RoleProtectedRoute requiredRole="student">
      <StudentProvider>
        <StudentLayout />
      </StudentProvider>
    </RoleProtectedRoute>
  }
>
  <Route index element={<StudentDashboard />} />

  <Route path="my-meals" element={<MyMeals />} />

  <Route path="menu-calendar" element={<MenuCalendar />} />

  <Route path="responses" element={<Responses />} />

  <Route path="meal-history" element={<MealHistory />} />

  <Route path="feedback" element={<Feedback />} />

  <Route path="announcements" element={<Announcements />} />

  <Route path="profile" element={<StudentProfile />} />

  <Route path="settings" element={<StudentSettings />} />

  <Route
    path="*"
    element={<Navigate to="/student/dashboard" replace />}
  />
</Route>

<Route
  path="/student"
  element={<Navigate to="/student/dashboard" replace />}
/>


        {/* =====================================================
            STUDENT - MY MEALS
        ===================================================== */}

        <Route
          path="/student/dashboard/my-meals"
          element={

            <RoleProtectedRoute
              requiredRole="student"
            >

              <StudentProvider>

                <MyMeals />

              </StudentProvider>

            </RoleProtectedRoute>

          }
        />


        {/* =====================================================
            STUDENT - MENU CALENDAR
        ===================================================== */}

        <Route
          path="/student/dashboard/menu-calendar"
          element={

            <RoleProtectedRoute
              requiredRole="student"
            >

              <StudentProvider>

                <MenuCalendar />

              </StudentProvider>

            </RoleProtectedRoute>

          }
        />


        {/* =====================================================
            STUDENT - RESPONSES
        ===================================================== */}

        <Route
          path="/student/dashboard/responses"
          element={

            <RoleProtectedRoute
              requiredRole="student"
            >

              <StudentProvider>

                <Responses />

              </StudentProvider>

            </RoleProtectedRoute>

          }
        />


        {/* =====================================================
            STUDENT - MEAL HISTORY
        ===================================================== */}

        <Route
          path="/student/dashboard/meal-history"
          element={

            <RoleProtectedRoute
              requiredRole="student"
            >

              <StudentProvider>

                <MealHistory />

              </StudentProvider>

            </RoleProtectedRoute>

          }
        />


        {/* =====================================================
            STUDENT - FEEDBACK
        ===================================================== */}

        <Route
          path="/student/dashboard/feedback"
          element={

            <RoleProtectedRoute
              requiredRole="student"
            >

              <StudentProvider>

                <Feedback />

              </StudentProvider>

            </RoleProtectedRoute>

          }
        />


        {/* =====================================================
            STUDENT - ANNOUNCEMENTS
        ===================================================== */}

        <Route
          path="/student/dashboard/announcements"
          element={

            <RoleProtectedRoute
              requiredRole="student"
            >

              <StudentProvider>

                <Announcements />

              </StudentProvider>

            </RoleProtectedRoute>

          }
        />


        {/* =====================================================
            STUDENT - PROFILE
        ===================================================== */}

        <Route
          path="/student/dashboard/profile"
          element={

            <RoleProtectedRoute
              requiredRole="student"
            >

              <StudentProvider>

                <StudentProfile />

              </StudentProvider>

            </RoleProtectedRoute>

          }
        />


        {/* =====================================================
            STUDENT - SETTINGS
        ===================================================== */}

        <Route
          path="/student/dashboard/settings"
          element={

            <RoleProtectedRoute
              requiredRole="student"
            >

              <StudentProvider>

                <StudentSettings />

              </StudentProvider>

            </RoleProtectedRoute>

          }
        />


        {/* =====================================================
            STUDENT ROOT
        ===================================================== */}

        <Route
          path="/student"
          element={
            <Navigate
              to="/student/dashboard"
              replace
            />
          }
        />


        {/* =====================================================
            STAFF
        ===================================================== */}

        <Route
          path="/staff"
          element={
            <RoleProtectedRoute requiredRole="staff">
              <StaffLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/staff/dashboard" replace />} />
          <Route path="dashboard" element={<StaffDashboard />} />
          <Route path="qr-scanner" element={<QRScanner />} />
          <Route path="attendance" element={<MealAttendance />} />
          <Route path="responses" element={<StudentResponses />} />
          <Route path="history" element={<AttendanceHistory />} />
          <Route path="announcements" element={<StaffAnnouncements />} />
          <Route path="notifications" element={<StaffNotifications />} />
          <Route path="profile" element={<StaffProfile />} />
          <Route path="settings" element={<StaffSettings />} />
        </Route>


        {/* =====================================================
            UNKNOWN URL
        ===================================================== */}

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