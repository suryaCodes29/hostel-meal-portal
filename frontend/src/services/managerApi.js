// ============================================================
// QUERY BUILDER
// ============================================================

export function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== "all"
    ) {
      query.set(key, value);
    }
  });

  const result = query.toString();

  return result ? `?${result}` : "";
}


// ============================================================
// DASHBOARD
// ============================================================

export async function getDashboardSummary(
  apiFetch,
  filterQueryString
) {
  const query = filterQueryString
    ? `?${filterQueryString}`
    : "";

  return apiFetch(
    `/api/manager/dashboard/summary${query}`
  );
}

export async function getResponseSummary(
  apiFetch,
  filterQueryString
) {
  const query = filterQueryString
    ? `?${filterQueryString}`
    : "";

  return apiFetch(
    `/api/manager/dashboard/response-summary${query}`
  );
}

export async function getSevenDayData(
  apiFetch,
  filterQueryString
) {
  const query = filterQueryString
    ? `?${filterQueryString}`
    : "";

  return apiFetch(
    `/api/manager/dashboard/seven-day${query}`
  );
}


// ============================================================
// STUDENTS
// ============================================================

export async function getStudents(
  apiFetch,
  params = {}
) {
  return apiFetch(
    `/api/manager/students${buildQuery(params)}`
  );
}

export async function createStudent(
  apiFetch,
  payload
) {
  return apiFetch(
    "/api/manager/students",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function assignStudent(
  apiFetch,
  userId,
  payload
) {
  return apiFetch(
    `/api/manager/students/${userId}/assign`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function changeStudentStatus(
  apiFetch,
  userId,
  isActive
) {
  return apiFetch(
    `/api/manager/students/${userId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        isActive,
      }),
    }
  );
}


// ============================================================
// MESS UNITS
// ============================================================

export async function getMessUnits(
  apiFetch,
  params = {}
) {
  return apiFetch(
    `/api/manager/mess-units${buildQuery(params)}`
  );
}

export async function createMessUnit(
  apiFetch,
  payload
) {
  return apiFetch(
    "/api/manager/mess-units",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}


// ============================================================
// HOSTELS
// ============================================================

export async function getHostels(
  apiFetch
) {
  return apiFetch(
    "/api/manager/hostels"
  );
}

export async function createHostel(
  apiFetch,
  payload
) {
  return apiFetch(
    "/api/manager/hostels",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function getHostelBlocks(
  apiFetch,
  hostelId
) {
  return apiFetch(
    `/api/manager/hostels/${hostelId}/blocks`
  );
}


// ============================================================
// MENU MANAGEMENT
// ============================================================

export async function getMenus(
  apiFetch,
  params = {}
) {
  return apiFetch(
    `/api/manager/menus${buildQuery(params)}`
  );
}

export async function getMenu(
  apiFetch,
  menuId
) {
  return apiFetch(
    `/api/manager/menus/${menuId}`
  );
}

export async function createMenu(
  apiFetch,
  payload
) {
  return apiFetch(
    "/api/manager/menus",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function updateMenu(
  apiFetch,
  menuId,
  payload
) {
  return apiFetch(
    `/api/manager/menus/${menuId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function publishMenu(
  apiFetch,
  menuId
) {
  return apiFetch(
    `/api/manager/menus/${menuId}/publish`,
    {
      method: "POST",
    }
  );
}

export async function unpublishMenu(
  apiFetch,
  menuId
) {
  return apiFetch(
    `/api/manager/menus/${menuId}/unpublish`,
    {
      method: "POST",
    }
  );
}

export async function copyMenu(
  apiFetch,
  menuId,
  payload
) {
  return apiFetch(
    `/api/manager/menus/${menuId}/copy`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function updateMenuItem(
  apiFetch,
  menuId,
  linkId,
  payload
) {
  return apiFetch(
    `/api/manager/menus/${menuId}/items/${linkId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteMenuItem(
  apiFetch,
  menuId,
  linkId
) {
  return apiFetch(
    `/api/manager/menus/${menuId}/items/${linkId}`,
    {
      method: "DELETE",
    }
  );
}

export async function getRecentMenus(
  apiFetch,
  params = {}
) {
  return apiFetch(
    `/api/manager/menus/recent${buildQuery(params)}`
  );
}

export async function getMenuCalendar(
  apiFetch,
  params = {}
) {
  return apiFetch(
    `/api/manager/menus/calendar${buildQuery(params)}`
  );
}

export async function getMenuHistory(
  apiFetch,
  params = {}
) {
  return apiFetch(
    `/api/manager/menus/history${buildQuery(params)}`
  );
}

export async function deleteMenu(
  apiFetch,
  menuId
) {
  return apiFetch(
    `/api/manager/menus/${menuId}`,
    {
      method: "DELETE",
    }
  );
}


// ============================================================
// MENU FOOD ITEMS
// ============================================================

export async function getMenuItems(
  apiFetch,
  params = {}
) {
  return apiFetch(
    `/api/manager/menu-items${buildQuery(params)}`
  );
}

export async function createMenuItem(
  apiFetch,
  payload
) {
  return apiFetch(
    "/api/manager/menu-items",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function updateMenuItemCatalog(
  apiFetch,
  itemId,
  payload
) {
  return apiFetch(
    `/api/manager/menu-items/${itemId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteMenuItemCatalog(
  apiFetch,
  itemId
) {
  return apiFetch(
    `/api/manager/menu-items/${itemId}`,
    {
      method: "DELETE",
    }
  );
}


// ============================================================
// MENU TEMPLATES
// ============================================================

export async function getMenuTemplates(
  apiFetch,
  params = {}
) {
  return apiFetch(
    `/api/manager/menu-templates${buildQuery(params)}`
  );
}

export async function getMenuTemplate(
  apiFetch,
  templateId
) {
  return apiFetch(
    `/api/manager/menu-templates/${templateId}`
  );
}

export async function createMenuTemplate(
  apiFetch,
  payload
) {
  return apiFetch(
    "/api/manager/menu-templates",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function updateMenuTemplate(
  apiFetch,
  templateId,
  payload
) {
  return apiFetch(
    `/api/manager/menu-templates/${templateId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function useMenuTemplate(
  apiFetch,
  templateId,
  payload
) {
  return apiFetch(
    `/api/manager/menu-templates/${templateId}/use`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteMenuTemplate(
  apiFetch,
  templateId
) {
  return apiFetch(
    `/api/manager/menu-templates/${templateId}`,
    {
      method: "DELETE",
    }
  );
}


// ============================================================
// FORECASTS
// ============================================================

export async function getForecasts(
  apiFetch,
  params = {}
) {
  return apiFetch(
    `/api/manager/forecasts${buildQuery(params)}`
  );
}


// ============================================================
// REPORTS
// ============================================================

export async function getReportSummary(
  apiFetch,
  params = {}
) {
  return apiFetch(
    `/api/manager/reports/summary${buildQuery(params)}`
  );
}

export async function getReportCharts(
  apiFetch,
  params = {}
) {
  return apiFetch(
    `/api/manager/reports/charts${buildQuery(params)}`
  );
}


// ============================================================
// STAFF
// ============================================================

export async function getStaff(
  apiFetch,
  params = {}
) {
  return apiFetch(
    `/api/manager/staff${buildQuery(params)}`
  );
}

export async function createStaff(
  apiFetch,
  payload
) {
  return apiFetch(
    "/api/manager/staff",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}


// ============================================================
// NOTIFICATIONS
// ============================================================

export async function getNotifications(
  apiFetch
) {
  return apiFetch(
    "/api/manager/notifications"
  );
}

export async function markAllNotificationsRead(
  apiFetch
) {
  return apiFetch(
    "/api/manager/notifications/mark-all-read",
    {
      method: "POST",
    }
  );
}