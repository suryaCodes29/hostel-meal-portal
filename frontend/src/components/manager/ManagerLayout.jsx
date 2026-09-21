import { Outlet } from "react-router-dom";

import ManagerHeader from "./ManagerHeader";
import ManagerSidebar from "./ManagerSidebar";

import { useManager } from "../../context/ManagerContext";

import "./managerLayout.css";


function ManagerLayout() {
  const {
    sidebarOpen,
    setSidebarOpen,
  } = useManager();


  const toggleSidebar = () => {
    setSidebarOpen(
      (current) => !current
    );
  };


  return (
    <div className="manager-dashboard-shell">

      {/* =========================================
          SIDEBAR
      ========================================= */}

      <ManagerSidebar />


      {/* =========================================
          MAIN DASHBOARD
      ========================================= */}

      <div className="manager-dashboard-main">

        {/* HEADER */}

        <ManagerHeader
          onMenuClick={toggleSidebar}
        />


        {/* =====================================
            CURRENT PAGE
        ===================================== */}

        <main className="manager-dashboard-content">

          <Outlet />

        </main>

      </div>

    </div>
  );
}


export default ManagerLayout;