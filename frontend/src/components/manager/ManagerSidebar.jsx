import {
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Settings,
  TrendingUp,
  UserCog,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { NavLink } from "react-router-dom";

import { useManager } from "../../context/ManagerContext";


const managementItems = [
  {
    label: "Overview",
    path: "/manager/dashboard",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Students",
    path: "/manager/dashboard/students",
    icon: Users,
  },
  {
    label: "Mess Units",
    path: "/manager/dashboard/mess-units",
    icon: UtensilsCrossed,
  },
  {
    label: "Menu Management",
    path: "/manager/dashboard/menu-management",
    icon: ClipboardList,
  },
  {
    label: "Hostel Details",
    path: "/manager/dashboard/hostels",
    icon: Building2,
  },
  {
    label: "Forecasts",
    path: "/manager/dashboard/forecasts",
    icon: TrendingUp,
  },
  {
    label: "Reports",
    path: "/manager/dashboard/reports",
    icon: BarChart3,
  },
  {
    label: "Staff",
    path: "/manager/dashboard/staff",
    icon: UserCog,
  },
];


const systemItems = [
  {
    label: "Settings",
    path: "/manager/dashboard/settings",
    icon: Settings,
  },
];


function ManagerSidebar() {
  const {
    sidebarOpen,
    setSidebarOpen,
  } = useManager();


  const closeSidebar = () => {
    setSidebarOpen(false);
  };


  const renderNavigationItem = (
    item
  ) => {
    const Icon = item.icon;


    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.end}
        onClick={closeSidebar}
        title={item.label}
        className={({
          isActive,
        }) =>
          `manager-nav-item ${
            isActive
              ? "active"
              : ""
          }`
        }
      >
        <Icon
          size={19}
          strokeWidth={1.9}
        />

        <span>
          {item.label}
        </span>
      </NavLink>
    );
  };


  return (
    <>
      {/* MOBILE OVERLAY */}

      <div
        className={`manager-sidebar-overlay ${
          sidebarOpen
            ? "show"
            : ""
        }`}
        onClick={closeSidebar}
      />


      {/* SIDEBAR */}

      <aside
        className={`manager-sidebar ${
          sidebarOpen
            ? "open"
            : ""
        }`}
      >

        {/* BRAND */}

        <div className="manager-sidebar-header">

          <div className="manager-sidebar-brand">

            <div className="manager-brand-icon">
              <UtensilsCrossed
                size={24}
              />
            </div>


            <div className="manager-sidebar-brand-text">

              <h2>
                Mess Portal
              </h2>

              <span>
                Manager Panel
              </span>

            </div>

          </div>


          <button
            type="button"
            className="manager-sidebar-close"
            onClick={
              closeSidebar
            }
            aria-label="Close sidebar"
          >
            <X size={21} />
          </button>

        </div>


        {/* NAVIGATION */}

        <nav className="manager-sidebar-navigation">

          <p className="manager-sidebar-section-title">
            MANAGEMENT
          </p>


          {managementItems.map(
            renderNavigationItem
          )}


          <p className="manager-sidebar-section-title manager-sidebar-system-title">
            SYSTEM
          </p>


          {systemItems.map(
            renderNavigationItem
          )}

        </nav>


        {/* FOOTER */}

        <div className="manager-sidebar-footer">

          <div className="manager-sidebar-footer-icon">
            <UtensilsCrossed
              size={19}
            />
          </div>


          <div className="manager-sidebar-footer-text">

            <strong>
              Hostel Mess
            </strong>

            <span>
              Management Portal
            </span>

          </div>

        </div>

      </aside>
    </>
  );
}


export default ManagerSidebar;