import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useManager,
} from "../../context/ManagerContext";

import PermanentDeleteModal
  from "../../components/manager/PermanentDeleteModal";

import {
  buildPermanentDeleteBody,
  createPermanentDeleteRequestGuard,
  getPermanentDeleteErrorMessage,
} from "../../utils/permanentDelete";

import "./staff.css";


const STAFF_ROLES = [
  "Cook",
  "Helper",
  "Supervisor",
  "Cleaner",
  "Store Manager",
];


const EMPTY_STAFF_FORM = {
  name: "",
  email: "",
  mobile: "",
  staffRole: "Cook",
  hostelId: "",
  blockId: "",
  messUnitId: "",
};


const EMPTY_EDIT_FORM = {
  name: "",
  email: "",
  mobile: "",
  staffRole: "Cook",
};


const EMPTY_ASSIGNMENT_FORM = {
  hostelId: "",
  blockId: "",
  messUnitId: "",
};


function normalizeStatus(value) {
  return String(
    value || "active"
  )
    .trim()
    .toLowerCase();
}


function Staff() {
  const {
    apiFetch,
    hostels,
    messUnits,
    invalidateManagerData,
  } = useManager();


  /* =========================================================
     DATA
  ========================================================= */

  const [
    staff,
    setStaff,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");


  /* =========================================================
     FILTERS
  ========================================================= */

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    hostelFilter,
    setHostelFilter,
  ] = useState("all");

  const [
    messFilter,
    setMessFilter,
  ] = useState("all");

  const [
    roleFilter,
    setRoleFilter,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");


  /* =========================================================
     ADD STAFF
  ========================================================= */

  const [
    addOpen,
    setAddOpen,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState({
    ...EMPTY_STAFF_FORM,
  });

  const [
    formBlocks,
    setFormBlocks,
  ] = useState([]);

  const [
    formError,
    setFormError,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);


  /* =========================================================
     VIEW
  ========================================================= */

  const [
    viewingStaff,
    setViewingStaff,
  ] = useState(null);


  /* =========================================================
     EDIT
  ========================================================= */

  const [
    editingStaff,
    setEditingStaff,
  ] = useState(null);

  const [
    editForm,
    setEditForm,
  ] = useState({
    ...EMPTY_EDIT_FORM,
  });

  const [
    editError,
    setEditError,
  ] = useState("");

  const [
    editSaving,
    setEditSaving,
  ] = useState(false);


  /* =========================================================
     ASSIGN / REASSIGN
  ========================================================= */

  const [
    assigningStaff,
    setAssigningStaff,
  ] = useState(null);

  const [
    assignmentForm,
    setAssignmentForm,
  ] = useState({
    ...EMPTY_ASSIGNMENT_FORM,
  });

  const [
    assignmentBlocks,
    setAssignmentBlocks,
  ] = useState([]);

  const [
    assignmentError,
    setAssignmentError,
  ] = useState("");

  const [
    assignmentSaving,
    setAssignmentSaving,
  ] = useState(false);


  /* =========================================================
     STATUS
  ========================================================= */

  const [
    statusTarget,
    setStatusTarget,
  ] = useState(null);

  const [
    statusSaving,
    setStatusSaving,
  ] = useState(false);


  /* =========================================================
     PERMANENT DELETE
  ========================================================= */

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null);

  const [
    deleteError,
    setDeleteError,
  ] = useState("");

  const [
    deleteSaving,
    setDeleteSaving,
  ] = useState(false);

  const deleteRequestGuardRef =
    useRef(
      createPermanentDeleteRequestGuard()
    );


  /* =========================================================
     LOAD STAFF
  ========================================================= */

  const loadStaff =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const params =
          new URLSearchParams();

        if (
          hostelFilter !== "all"
        ) {
          params.set(
            "hostel_id",
            hostelFilter
          );
        }

        if (
          messFilter !== "all"
        ) {
          params.set(
            "mess_unit_id",
            messFilter
          );
        }

        if (search.trim()) {
          params.set(
            "search",
            search.trim()
          );
        }

        const query =
          params.toString();

        const data =
          await apiFetch(
            query
              ? `/api/manager/staff?${query}`
              : "/api/manager/staff"
          );

        setStaff(
          Array.isArray(
            data.staff
          )
            ? data.staff
            : []
        );
      } catch (loadError) {
        console.error(
          "Staff loading error:",
          loadError
        );

        setError(
          loadError.message ||
            "Unable to load Mess Staff."
        );

        setStaff([]);
      } finally {
        setLoading(false);
      }
    }, [
      apiFetch,
      hostelFilter,
      messFilter,
      search,
    ]);


  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          loadStaff();
        },
        250
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [loadStaff]);


  /* =========================================================
     PAGE MESS FILTER OPTIONS
  ========================================================= */

  const pageMessUnits =
    useMemo(() => {
      if (
        hostelFilter === "all"
      ) {
        return messUnits;
      }

      return messUnits.filter(
        (mess) => {
          const hostelId =
            mess.hostelId ??
            mess.hostel_id ??
            mess.hostel?.id;

          return (
            String(hostelId) ===
            String(hostelFilter)
          );
        }
      );
    }, [
      messUnits,
      hostelFilter,
    ]);


  useEffect(() => {
    if (
      messFilter === "all"
    ) {
      return;
    }

    const exists =
      pageMessUnits.some(
        (mess) =>
          String(mess.id) ===
          String(messFilter)
      );

    if (!exists) {
      setMessFilter("all");
    }
  }, [
    pageMessUnits,
    messFilter,
  ]);


  /* =========================================================
     LOCAL ROLE / STATUS FILTER
  ========================================================= */

  const filteredStaff =
    useMemo(() => {
      return staff.filter(
        (person) => {
          const matchesRole =
            roleFilter === "all" ||
            String(
              person.staffRole || ""
            ) === roleFilter;

          const matchesStatus =
            statusFilter === "all" ||
            normalizeStatus(
              person.status
            ) === statusFilter;

          return (
            matchesRole &&
            matchesStatus
          );
        }
      );
    }, [
      staff,
      roleFilter,
      statusFilter,
    ]);


  /* =========================================================
     SUMMARY
  ========================================================= */

  const summary =
    useMemo(() => {
      return staff.reduce(
        (
          result,
          person
        ) => {
          result.total += 1;

          if (
            normalizeStatus(
              person.status
            ) === "active"
          ) {
            result.active += 1;
          }

          if (
            person.staffRole ===
            "Supervisor"
          ) {
            result.supervisors += 1;
          }

          if (
            person.mustChangePassword
          ) {
            result.passwordPending += 1;
          }

          return result;
        },
        {
          total: 0,
          active: 0,
          supervisors: 0,
          passwordPending: 0,
        }
      );
    }, [staff]);


  /* =========================================================
     CLEAR FILTERS
  ========================================================= */

  const clearFilters = () => {
    setSearch("");
    setHostelFilter("all");
    setMessFilter("all");
    setRoleFilter("all");
    setStatusFilter("all");
  };


  /* =========================================================
     BLOCK HELPERS
  ========================================================= */

  const loadBlocksForHostel =
    async (hostelId) => {
      if (!hostelId) {
        return [];
      }

      try {
        const data =
          await apiFetch(
            `/api/manager/hostels/${hostelId}/blocks`
          );

        return Array.isArray(
          data.blocks
        )
          ? data.blocks
          : [];
      } catch (blockError) {
        console.error(
          "Unable to load Blocks:",
          blockError
        );

        return [];
      }
    };


  /* =========================================================
     ADD STAFF
  ========================================================= */

  const openAddStaff = () => {
    setForm({
      ...EMPTY_STAFF_FORM,
    });

    setFormBlocks([]);
    setFormError("");
    setSuccessMessage("");
    setAddOpen(true);
  };


  const closeAddStaff = () => {
    if (saving) {
      return;
    }

    setAddOpen(false);
    setFormError("");
  };


  const handleFormChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      setForm(
        (current) => ({
          ...current,
          [name]: value,
        })
      );
    };


  const handleHostelChange =
    async (event) => {
      const hostelId =
        event.target.value;

      setForm(
        (current) => ({
          ...current,
          hostelId,
          blockId: "",
          messUnitId: "",
        })
      );

      setFormBlocks(
        await loadBlocksForHostel(
          hostelId
        )
      );
    };


  const formMessUnits =
    useMemo(() => {
      if (!form.hostelId) {
        return [];
      }

      return messUnits.filter(
        (mess) => {
          const hostelId =
            mess.hostelId ??
            mess.hostel_id ??
            mess.hostel?.id;

          return (
            String(hostelId) ===
            String(form.hostelId)
          );
        }
      );
    }, [
      messUnits,
      form.hostelId,
    ]);


  const validateForm = () => {
    if (!form.name.trim()) {
      return (
        "Please enter the Staff member's full name."
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      return (
        "Please enter a valid registered email address."
      );
    }

    if (
      !/^[6-9]\d{9}$/.test(
        form.mobile.trim()
      )
    ) {
      return (
        "Please enter a valid 10-digit mobile number."
      );
    }

    if (
      !STAFF_ROLES.includes(
        form.staffRole
      )
    ) {
      return (
        "Please select a valid Staff role."
      );
    }

    if (!form.hostelId) {
      return (
        "Please select a Hostel."
      );
    }

    if (!form.messUnitId) {
      return (
        "Please select a Mess Unit."
      );
    }

    return "";
  };


  const createStaff =
    async (event) => {
      event.preventDefault();

      const validationError =
        validateForm();

      if (validationError) {
        setFormError(
          validationError
        );
        return;
      }

      setSaving(true);
      setFormError("");

      try {
        const response =
          await apiFetch(
            "/api/manager/staff",
            {
              method: "POST",

              body:
                JSON.stringify({
                  name:
                    form.name.trim(),

                  email:
                    form.email
                      .trim()
                      .toLowerCase(),

                  mobile:
                    form.mobile
                      .trim(),

                  staffRole:
                    form.staffRole,

                  hostelId:
                    Number(
                      form.hostelId
                    ),

                  blockId:
                    form.blockId
                      ? Number(
                          form.blockId
                        )
                      : null,

                  messUnitId:
                    Number(
                      form.messUnitId
                    ),
                }),
            }
          );

        setAddOpen(false);

        setSuccessMessage(
          response.message ||
            "Staff added successfully."
        );

        await loadStaff();

        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      } catch (saveError) {
        console.error(
          "Create Staff error:",
          saveError
        );

        setFormError(
          saveError.message ||
            "Unable to create Staff account."
        );
      } finally {
        setSaving(false);
      }
    };


  /* =========================================================
     EDIT STAFF
  ========================================================= */

  const openEditStaff =
    (person) => {
      setEditingStaff(
        person
      );

      setEditForm({
        name:
          person.name || "",

        email:
          person.email || "",

        mobile:
          person.mobile || "",

        staffRole:
          person.staffRole ||
          "Cook",
      });

      setEditError("");
      setSuccessMessage("");
    };


  const closeEditStaff = () => {
    if (editSaving) {
      return;
    }

    setEditingStaff(null);
    setEditError("");
  };


  const handleEditChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      setEditForm(
        (current) => ({
          ...current,
          [name]: value,
        })
      );
    };


  const validateEditForm = () => {
    if (
      !editForm.name.trim()
    ) {
      return (
        "Full Name is required."
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        editForm.email.trim()
      )
    ) {
      return (
        "Please enter a valid email address."
      );
    }

    if (
      !/^[6-9]\d{9}$/.test(
        editForm.mobile.trim()
      )
    ) {
      return (
        "Please enter a valid 10-digit mobile number."
      );
    }

    if (
      !STAFF_ROLES.includes(
        editForm.staffRole
      )
    ) {
      return (
        "Please select a valid Staff role."
      );
    }

    return "";
  };


  const saveEditedStaff =
    async (event) => {
      event.preventDefault();

      if (!editingStaff) {
        return;
      }

      const validationError =
        validateEditForm();

      if (validationError) {
        setEditError(
          validationError
        );
        return;
      }

      setEditSaving(true);
      setEditError("");

      try {
        const response =
          await apiFetch(
            `/api/manager/staff/${editingStaff.id}`,
            {
              method: "PUT",

              body:
                JSON.stringify({
                  name:
                    editForm.name
                      .trim(),

                  email:
                    editForm.email
                      .trim()
                      .toLowerCase(),

                  mobile:
                    editForm.mobile
                      .trim(),

                  staffRole:
                    editForm.staffRole,
                }),
            }
          );

        setEditingStaff(null);

        setSuccessMessage(
          response.message ||
            "Staff updated successfully."
        );

        await loadStaff();

        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      } catch (editRequestError) {
        console.error(
          "Staff edit error:",
          editRequestError
        );

        setEditError(
          editRequestError.message ||
            "Unable to update Staff."
        );
      } finally {
        setEditSaving(false);
      }
    };


  /* =========================================================
     ASSIGN / REASSIGN STAFF
  ========================================================= */

  const openAssignment =
    async (person) => {
      const hostelId =
        person.hostel?.id
          ? String(
              person.hostel.id
            )
          : "";

      setAssigningStaff(
        person
      );

      setAssignmentForm({
        hostelId,

        blockId:
          person.block?.id
            ? String(
                person.block.id
              )
            : "",

        messUnitId:
          person.messUnit?.id
            ? String(
                person.messUnit.id
              )
            : "",
      });

      setAssignmentError("");

      setAssignmentBlocks(
        await loadBlocksForHostel(
          hostelId
        )
      );
    };


  const closeAssignment = () => {
    if (
      assignmentSaving
    ) {
      return;
    }

    setAssigningStaff(null);
    setAssignmentError("");
  };


  const handleAssignmentHostelChange =
    async (event) => {
      const hostelId =
        event.target.value;

      setAssignmentForm(
        (current) => ({
          ...current,
          hostelId,
          blockId: "",
          messUnitId: "",
        })
      );

      setAssignmentBlocks(
        await loadBlocksForHostel(
          hostelId
        )
      );
    };


  const assignmentMessUnits =
    useMemo(() => {
      if (
        !assignmentForm.hostelId
      ) {
        return [];
      }

      return messUnits.filter(
        (mess) => {
          const hostelId =
            mess.hostelId ??
            mess.hostel_id ??
            mess.hostel?.id;

          return (
            String(hostelId) ===
            String(
              assignmentForm.hostelId
            )
          );
        }
      );
    }, [
      messUnits,
      assignmentForm.hostelId,
    ]);


  const saveAssignment =
    async (event) => {
      event.preventDefault();

      if (!assigningStaff) {
        return;
      }

      if (
        !assignmentForm.hostelId
      ) {
        setAssignmentError(
          "Please select a Hostel."
        );
        return;
      }

      if (
        !assignmentForm.messUnitId
      ) {
        setAssignmentError(
          "Please select a Mess Unit."
        );
        return;
      }

      setAssignmentSaving(true);
      setAssignmentError("");

      try {
        const response =
          await apiFetch(
            `/api/manager/staff/${assigningStaff.id}/assign`,
            {
              method: "PUT",

              body:
                JSON.stringify({
                  hostelId:
                    Number(
                      assignmentForm
                        .hostelId
                    ),

                  blockId:
                    assignmentForm
                      .blockId
                      ? Number(
                          assignmentForm
                            .blockId
                        )
                      : null,

                  messUnitId:
                    Number(
                      assignmentForm
                        .messUnitId
                    ),
                }),
            }
          );

        setAssigningStaff(null);

        setSuccessMessage(
          response.message ||
            "Staff assignment updated successfully."
        );

        await loadStaff();

        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      } catch (
        assignmentRequestError
      ) {
        console.error(
          "Staff assignment error:",
          assignmentRequestError
        );

        setAssignmentError(
          assignmentRequestError.message ||
            "Unable to reassign Staff."
        );
      } finally {
        setAssignmentSaving(false);
      }
    };


  /* =========================================================
     ACTIVATE / DEACTIVATE
  ========================================================= */

  const confirmStatusChange =
    async () => {
      if (!statusTarget) {
        return;
      }

      const currentlyActive =
        normalizeStatus(
          statusTarget.status
        ) === "active";

      const nextActive =
        !currentlyActive;

      setStatusSaving(true);
      setError("");

      try {
        const response =
          await apiFetch(
            `/api/manager/staff/${statusTarget.id}/status`,
            {
              method: "PATCH",

              body:
                JSON.stringify({
                  isActive:
                    nextActive,
                }),
            }
          );

        setStatusTarget(null);

        setSuccessMessage(
          response.message ||
            (
              nextActive
                ? "Staff activated successfully."
                : "Staff deactivated successfully."
            )
        );

        await loadStaff();

        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      } catch (
        statusRequestError
      ) {
        console.error(
          "Staff status error:",
          statusRequestError
        );

        setError(
          statusRequestError.message ||
            "Unable to change Staff status."
        );
      } finally {
        setStatusSaving(false);
      }
    };


  /* =========================================================
     PERMANENT DELETE
  ========================================================= */

  const openDeleteStaff =
    (person) => {
      if (!person) {
        return;
      }

      setDeleteError("");
      setSuccessMessage("");
      setDeleteTarget(person);
    };


  const closeDeleteStaff = () => {
    if (deleteSaving) {
      return;
    }

    setDeleteError("");
    setDeleteTarget(null);
  };


  const permanentlyDeleteStaff =
    async (confirmation) => {
      if (!deleteTarget) {
        return;
      }

      const requestGuard =
        deleteRequestGuardRef.current;

      if (
        !requestGuard.tryStart()
      ) {
        return;
      }

      const staffToDelete =
        deleteTarget;

      setDeleteSaving(true);
      setDeleteError("");

      try {
        const response =
          await apiFetch(
            `/api/manager/staff/${staffToDelete.id}`,
            {
              method: "DELETE",

              body:
                JSON.stringify(
                  buildPermanentDeleteBody(
                    confirmation
                  )
                ),
            }
          );

        /*
         * Immediately remove the
         * deleted Staff member from
         * the visible table.
         */
        setStaff(
          (currentStaff) =>
            currentStaff.filter(
              (person) =>
                person.id !==
                staffToDelete.id
            )
        );

        setDeleteTarget(null);

        setSuccessMessage(
          response.message ||
            `${staffToDelete.name} deleted permanently.`
        );

        /*
         * Confirm the latest
         * Manager-scoped data from
         * the backend.
         */
        await loadStaff();

        /*
         * Refresh Overview counts,
         * filters and related Manager
         * context without reloading
         * the application.
         */
        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      } catch (
        deleteRequestError
      ) {
        /*
         * Keep the modal open if the
         * backend rejected or failed
         * the deletion.
         */
        setDeleteError(
          getPermanentDeleteErrorMessage(
            deleteRequestError,
            "Unable to permanently delete this Staff member."
          )
        );
      } finally {
        requestGuard.finish();
        setDeleteSaving(false);
      }
    };


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="staff-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="staff-page-header">

        <div>
          <span className="staff-eyebrow">
            STAFF MANAGEMENT
          </span>

          <h1>
            Mess Staff
          </h1>

          <p>
            Manage mess staff members
          </p>
        </div>


        <button
          type="button"
          className="staff-primary-button"
          onClick={
            openAddStaff
          }
          disabled={
            hostels.length === 0
          }
        >
          <Plus size={17} />

          Add Staff
        </button>

      </div>


      {/* =====================================================
          SUCCESS
      ===================================================== */}

      {successMessage && (
        <div className="staff-success-message">

          <CheckCircle2
            size={18}
          />

          <span>
            {successMessage}
          </span>

          <button
            type="button"
            aria-label="Close success message"
            onClick={() =>
              setSuccessMessage("")
            }
          >
            <X size={16} />
          </button>

        </div>
      )}


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="staff-error-message">

          <AlertTriangle
            size={18}
          />

          <div>
            <strong>
              Unable to load Staff
            </strong>

            <span>
              {error}
            </span>
          </div>

          <button
            type="button"
            onClick={
              loadStaff
            }
          >
            Retry
          </button>

        </div>
      )}


      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section className="staff-summary-grid">

        <article className="staff-summary-card">

          <div className="staff-summary-icon">
            <Users size={20} />
          </div>

          <div>
            <span>
              Total Staff
            </span>

            <strong>
              {summary.total}
            </strong>
          </div>

        </article>


        <article className="staff-summary-card">

          <div className="staff-summary-icon green">
            <CheckCircle2
              size={20}
            />
          </div>

          <div>
            <span>
              Active Staff
            </span>

            <strong>
              {summary.active}
            </strong>
          </div>

        </article>


        <article className="staff-summary-card">

          <div className="staff-summary-icon orange">
            <ShieldCheck
              size={20}
            />
          </div>

          <div>
            <span>
              Supervisors
            </span>

            <strong>
              {summary.supervisors}
            </strong>
          </div>

        </article>


        <article className="staff-summary-card">

          <div className="staff-summary-icon blue">
            <UserCog
              size={20}
            />
          </div>

          <div>
            <span>
              Password Change Pending
            </span>

            <strong>
              {summary.passwordPending}
            </strong>
          </div>

        </article>

      </section>


      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section className="staff-filter-card">

        <div className="staff-search-box">

          <Search size={16} />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search Staff ID, name or email"
          />

        </div>


        <div className="staff-filter-field">

          <label>
            Hostel
          </label>

          <select
            value={
              hostelFilter
            }
            onChange={(event) => {
              setHostelFilter(
                event.target.value
              );

              setMessFilter(
                "all"
              );
            }}
          >
            <option value="all">
              All Hostels
            </option>

            {hostels.map(
              (hostel) => (
                <option
                  key={
                    hostel.id
                  }
                  value={
                    hostel.id
                  }
                >
                  {hostel.name}
                </option>
              )
            )}
          </select>

        </div>


        <div className="staff-filter-field">

          <label>
            Mess Unit
          </label>

          <select
            value={
              messFilter
            }
            onChange={(event) =>
              setMessFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Mess Units
            </option>

            {pageMessUnits.map(
              (mess) => (
                <option
                  key={
                    mess.id
                  }
                  value={
                    mess.id
                  }
                >
                  {mess.name}
                </option>
              )
            )}
          </select>

        </div>


        <div className="staff-filter-field">

          <label>
            Staff Role
          </label>

          <select
            value={
              roleFilter
            }
            onChange={(event) =>
              setRoleFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Roles
            </option>

            {STAFF_ROLES.map(
              (role) => (
                <option
                  key={role}
                  value={role}
                >
                  {role}
                </option>
              )
            )}
          </select>

        </div>


        <div className="staff-filter-field">

          <label>
            Status
          </label>

          <select
            value={
              statusFilter
            }
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All
            </option>

            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>

        </div>


        <button
          type="button"
          className="staff-clear-button"
          onClick={
            clearFilters
          }
        >
          Clear Filters
        </button>

      </section>


      {/* =====================================================
          TABLE
      ===================================================== */}

      <section className="staff-table-card">

        <div className="staff-table-heading">

          <div>
            <strong>
              Staff Records
            </strong>

            <span>
              {filteredStaff.length}
              {" "}
              matching records
            </span>
          </div>

        </div>


        {loading ? (

          <div className="staff-loading">

            <RefreshCw
              size={25}
              className="staff-spin"
            />

            <span>
              Loading Mess Staff...
            </span>

          </div>

        ) : filteredStaff.length ===
          0 ? (

          <div className="staff-empty-state">

            <UserCog size={38} />

            <h2>
              No Staff found
            </h2>

            <p>
              No Staff records match the selected filters.
            </p>

          </div>

        ) : (

          <div className="staff-table-wrapper">

            <table className="staff-table">

              <thead>
                <tr>

                  <th>#</th>

                  <th>
                    Staff ID
                  </th>

                  <th>
                    Name
                  </th>

                  <th>
                    Role
                  </th>

                  <th>
                    Hostel
                  </th>

                  <th>
                    Block
                  </th>

                  <th>
                    Mess Unit
                  </th>

                  <th>
                    Phone
                  </th>

                  <th>
                    Registered Email
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Actions
                  </th>

                </tr>
              </thead>


              <tbody>

                {filteredStaff.map(
                  (
                    person,
                    index
                  ) => (

                    <tr
                      key={
                        person.id
                      }
                    >

                      <td>
                        {index + 1}
                      </td>


                      <td>
                        <strong className="staff-id">
                          {person.staffId ||
                            "—"}
                        </strong>
                      </td>


                      <td>
                        <div className="staff-name-cell">

                          <div className="staff-avatar">
                            <UserCog
                              size={15}
                            />
                          </div>

                          <span>
                            {person.name}
                          </span>

                        </div>
                      </td>


                      <td>
                        <span className="staff-role-badge">
                          {person.staffRole ||
                            "Mess Staff"}
                        </span>
                      </td>


                      <td>
                        {person.hostel?.name ||
                          "Unassigned"}
                      </td>


                      <td>
                        {person.block?.name ||
                          "—"}
                      </td>


                      <td>
                        {person.messUnit?.name ||
                          "Unassigned"}
                      </td>


                      <td>
                        {person.mobile ||
                          "—"}
                      </td>


                      <td>
                        {person.email}
                      </td>


                      <td>
                        <span
                          className={`staff-status-badge ${
                            normalizeStatus(
                              person.status
                            ) ===
                            "active"
                              ? "active"
                              : "inactive"
                          }`}
                        >
                          {normalizeStatus(
                            person.status
                          ) ===
                          "active"
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>


                      <td>
                        <div className="staff-row-actions">

                          <button
                            type="button"
                            onClick={() =>
                              setViewingStaff(
                                person
                              )
                            }
                          >
                            <Eye
                              size={14}
                            />

                            View
                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              openEditStaff(
                                person
                              )
                            }
                          >
                            <Edit3
                              size={14}
                            />

                            Edit
                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              openAssignment(
                                person
                              )
                            }
                          >
                            Reassign
                          </button>


                          <button
                            type="button"
                            className={
                              normalizeStatus(
                                person.status
                              ) ===
                              "active"
                                ? "deactivate"
                                : "activate"
                            }
                            onClick={() =>
                              setStatusTarget(
                                person
                              )
                            }
                          >
                            {normalizeStatus(
                              person.status
                            ) ===
                            "active"
                              ? "Deactivate"
                              : "Activate"}
                          </button>


                          <button
                            type="button"
                            className="manager-delete-action"
                            onClick={() =>
                              openDeleteStaff(
                                person
                              )
                            }
                            title={`Delete ${person.name} permanently`}
                            aria-label={`Delete ${person.name} permanently`}
                          >
                            <Trash2
                              size={14}
                            />

                            Delete
                          </button>

                        </div>
                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

      </section>


      {/* =====================================================
          ADD STAFF MODAL
      ===================================================== */}

      {addOpen && (
        <div className="staff-modal-backdrop">

          <div className="staff-modal">

            <div className="staff-modal-header">

              <div>
                <h2>
                  Add Staff
                </h2>

                <p>
                  Create a Mess Staff account and assign
                  Hostel, Block and Mess Unit.
                </p>
              </div>


              <button
                type="button"
                onClick={
                  closeAddStaff
                }
                aria-label="Close Add Staff"
              >
                <X size={20} />
              </button>

            </div>


            <form
              className="staff-form"
              onSubmit={
                createStaff
              }
            >

              {formError && (
                <div className="staff-form-error">

                  <AlertTriangle
                    size={17}
                  />

                  <span>
                    {formError}
                  </span>

                </div>
              )}


              <div className="staff-form-grid">

                <div className="staff-form-field">

                  <label>
                    Full Name
                  </label>

                  <input
                    name="name"
                    value={
                      form.name
                    }
                    onChange={
                      handleFormChange
                    }
                  />

                </div>


                <div className="staff-form-field">

                  <label>
                    Registered Email
                  </label>

                  <input
                    name="email"
                    type="email"
                    value={
                      form.email
                    }
                    onChange={
                      handleFormChange
                    }
                  />

                </div>


                <div className="staff-form-field">

                  <label>
                    Mobile Number
                  </label>

                  <input
                    name="mobile"
                    value={
                      form.mobile
                    }
                    onChange={
                      handleFormChange
                    }
                    maxLength={10}
                    inputMode="numeric"
                  />

                </div>


                <div className="staff-form-field">

                  <label>
                    Staff Role
                  </label>

                  <select
                    name="staffRole"
                    value={
                      form.staffRole
                    }
                    onChange={
                      handleFormChange
                    }
                  >

                    {STAFF_ROLES.map(
                      (role) => (
                        <option
                          key={role}
                          value={role}
                        >
                          {role}
                        </option>
                      )
                    )}

                  </select>

                </div>


                <div className="staff-form-field">

                  <label>
                    Hostel
                  </label>

                  <select
                    name="hostelId"
                    value={
                      form.hostelId
                    }
                    onChange={
                      handleHostelChange
                    }
                  >
                    <option value="">
                      Select Hostel
                    </option>

                    {hostels.map(
                      (hostel) => (
                        <option
                          key={
                            hostel.id
                          }
                          value={
                            hostel.id
                          }
                        >
                          {hostel.name}
                        </option>
                      )
                    )}

                  </select>

                </div>


                <div className="staff-form-field">

                  <label>
                    Hostel Block
                  </label>

                  <select
                    name="blockId"
                    value={
                      form.blockId
                    }
                    onChange={
                      handleFormChange
                    }
                    disabled={
                      !form.hostelId
                    }
                  >
                    <option value="">
                      No specific Block
                    </option>

                    {formBlocks.map(
                      (block) => (
                        <option
                          key={
                            block.id
                          }
                          value={
                            block.id
                          }
                        >
                          {block.name}
                        </option>
                      )
                    )}

                  </select>

                </div>


                <div className="staff-form-field">

                  <label>
                    Assigned Mess
                  </label>

                  <select
                    name="messUnitId"
                    value={
                      form.messUnitId
                    }
                    onChange={
                      handleFormChange
                    }
                    disabled={
                      !form.hostelId
                    }
                  >
                    <option value="">
                      Select Mess Unit
                    </option>

                    {formMessUnits.map(
                      (mess) => (
                        <option
                          key={
                            mess.id
                          }
                          value={
                            mess.id
                          }
                        >
                          {mess.name}
                        </option>
                      )
                    )}

                  </select>

                </div>

              </div>


              <div className="staff-password-note">

                <ShieldCheck
                  size={20}
                />

                <div>

                  <strong>
                    First Login Security
                  </strong>

                  <span>
                    Initial password is
                    {" "}
                    <b>
                      Mess@123
                    </b>
                    .
                    {" "}
                    Staff must change it before accessing
                    the Staff Dashboard.
                  </span>

                </div>

              </div>


              <div className="staff-modal-actions">

                <button
                  type="button"
                  className="staff-secondary-button"
                  onClick={
                    closeAddStaff
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="staff-primary-button"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Creating..."
                    : "Add Staff"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* =====================================================
          VIEW MODAL
      ===================================================== */}

      {viewingStaff && (
        <div className="staff-modal-backdrop">

          <div className="staff-modal staff-view-modal">

            <div className="staff-modal-header">

              <div>
                <span className="staff-eyebrow">
                  STAFF DETAILS
                </span>

                <h2>
                  {viewingStaff.name}
                </h2>

                <p>
                  {viewingStaff.staffId}
                </p>
              </div>


              <button
                type="button"
                onClick={() =>
                  setViewingStaff(
                    null
                  )
                }
                aria-label="Close Staff details"
              >
                <X size={20} />
              </button>

            </div>


            <div className="staff-view-content">

              <div>
                <span>
                  Staff ID
                </span>

                <strong>
                  {viewingStaff.staffId ||
                    "—"}
                </strong>
              </div>


              <div>
                <span>
                  Role
                </span>

                <strong>
                  {viewingStaff.staffRole ||
                    "Mess Staff"}
                </strong>
              </div>


              <div>
                <span>
                  Email
                </span>

                <strong>
                  {viewingStaff.email}
                </strong>
              </div>


              <div>
                <span>
                  Mobile
                </span>

                <strong>
                  {viewingStaff.mobile ||
                    "—"}
                </strong>
              </div>


              <div>
                <span>
                  Hostel
                </span>

                <strong>
                  {viewingStaff.hostel?.name ||
                    "Unassigned"}
                </strong>
              </div>


              <div>
                <span>
                  Block
                </span>

                <strong>
                  {viewingStaff.block?.name ||
                    "—"}
                </strong>
              </div>


              <div>
                <span>
                  Mess Unit
                </span>

                <strong>
                  {viewingStaff.messUnit?.name ||
                    "Unassigned"}
                </strong>
              </div>


              <div>
                <span>
                  Status
                </span>

                <strong>
                  {normalizeStatus(
                    viewingStaff.status
                  ) === "active"
                    ? "Active"
                    : "Inactive"}
                </strong>
              </div>


              <div>
                <span>
                  Password Change
                </span>

                <strong>
                  {viewingStaff.mustChangePassword
                    ? "Required"
                    : "Completed"}
                </strong>
              </div>

            </div>


            <div className="staff-modal-actions">

              <button
                type="button"
                className="staff-secondary-button"
                onClick={() =>
                  setViewingStaff(
                    null
                  )
                }
              >
                Close
              </button>


              <button
                type="button"
                className="staff-primary-button"
                onClick={() => {
                  const person =
                    viewingStaff;

                  setViewingStaff(
                    null
                  );

                  openEditStaff(
                    person
                  );
                }}
              >
                <Edit3
                  size={15}
                />

                Edit Staff
              </button>

            </div>

          </div>

        </div>
      )}


      {/* =====================================================
          EDIT MODAL
      ===================================================== */}

      {editingStaff && (
        <div className="staff-modal-backdrop">

          <div className="staff-modal">

            <div className="staff-modal-header">

              <div>
                <h2>
                  Edit Staff
                </h2>

                <p>
                  Update Staff profile information.
                </p>
              </div>


              <button
                type="button"
                onClick={
                  closeEditStaff
                }
                aria-label="Close Edit Staff"
              >
                <X size={20} />
              </button>

            </div>


            <form
              className="staff-form"
              onSubmit={
                saveEditedStaff
              }
            >

              {editError && (
                <div className="staff-form-error">

                  <AlertTriangle
                    size={17}
                  />

                  <span>
                    {editError}
                  </span>

                </div>
              )}


              <div className="staff-form-grid">

                <div className="staff-form-field">

                  <label>
                    Full Name
                  </label>

                  <input
                    name="name"
                    value={
                      editForm.name
                    }
                    onChange={
                      handleEditChange
                    }
                  />

                </div>


                <div className="staff-form-field">

                  <label>
                    Registered Email
                  </label>

                  <input
                    name="email"
                    type="email"
                    value={
                      editForm.email
                    }
                    onChange={
                      handleEditChange
                    }
                  />

                </div>


                <div className="staff-form-field">

                  <label>
                    Mobile Number
                  </label>

                  <input
                    name="mobile"
                    value={
                      editForm.mobile
                    }
                    onChange={
                      handleEditChange
                    }
                    maxLength={10}
                  />

                </div>


                <div className="staff-form-field">

                  <label>
                    Staff Role
                  </label>

                  <select
                    name="staffRole"
                    value={
                      editForm.staffRole
                    }
                    onChange={
                      handleEditChange
                    }
                  >

                    {STAFF_ROLES.map(
                      (role) => (
                        <option
                          key={role}
                          value={role}
                        >
                          {role}
                        </option>
                      )
                    )}

                  </select>

                </div>

              </div>


              <div className="staff-modal-actions">

                <button
                  type="button"
                  className="staff-secondary-button"
                  onClick={
                    closeEditStaff
                  }
                  disabled={
                    editSaving
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="staff-primary-button"
                  disabled={
                    editSaving
                  }
                >
                  {editSaving
                    ? "Saving..."
                    : "Save Changes"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* =====================================================
          REASSIGN MODAL
      ===================================================== */}

      {assigningStaff && (
        <div className="staff-modal-backdrop">

          <div className="staff-modal">

            <div className="staff-modal-header">

              <div>
                <h2>
                  Reassign Staff
                </h2>

                <p>
                  {assigningStaff.name}
                  {" • "}
                  {assigningStaff.staffId}
                </p>
              </div>


              <button
                type="button"
                onClick={
                  closeAssignment
                }
                aria-label="Close Reassign Staff"
              >
                <X size={20} />
              </button>

            </div>


            <form
              className="staff-form"
              onSubmit={
                saveAssignment
              }
            >

              {assignmentError && (
                <div className="staff-form-error">

                  <AlertTriangle
                    size={17}
                  />

                  <span>
                    {assignmentError}
                  </span>

                </div>
              )}


              <div className="staff-form-grid">

                <div className="staff-form-field">

                  <label>
                    Hostel
                  </label>

                  <select
                    value={
                      assignmentForm.hostelId
                    }
                    onChange={
                      handleAssignmentHostelChange
                    }
                  >
                    <option value="">
                      Select Hostel
                    </option>

                    {hostels.map(
                      (hostel) => (
                        <option
                          key={
                            hostel.id
                          }
                          value={
                            hostel.id
                          }
                        >
                          {hostel.name}
                        </option>
                      )
                    )}

                  </select>

                </div>


                <div className="staff-form-field">

                  <label>
                    Block
                  </label>

                  <select
                    value={
                      assignmentForm.blockId
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          blockId:
                            event.target.value,
                        })
                      )
                    }
                    disabled={
                      !assignmentForm.hostelId
                    }
                  >
                    <option value="">
                      No specific Block
                    </option>

                    {assignmentBlocks.map(
                      (block) => (
                        <option
                          key={
                            block.id
                          }
                          value={
                            block.id
                          }
                        >
                          {block.name}
                        </option>
                      )
                    )}

                  </select>

                </div>


                <div className="staff-form-field">

                  <label>
                    Mess Unit
                  </label>

                  <select
                    value={
                      assignmentForm.messUnitId
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,
                          messUnitId:
                            event.target.value,
                        })
                      )
                    }
                    disabled={
                      !assignmentForm.hostelId
                    }
                  >
                    <option value="">
                      Select Mess Unit
                    </option>

                    {assignmentMessUnits.map(
                      (mess) => (
                        <option
                          key={
                            mess.id
                          }
                          value={
                            mess.id
                          }
                        >
                          {mess.name}
                        </option>
                      )
                    )}

                  </select>

                </div>

              </div>


              <div className="staff-modal-actions">

                <button
                  type="button"
                  className="staff-secondary-button"
                  onClick={
                    closeAssignment
                  }
                  disabled={
                    assignmentSaving
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="staff-primary-button"
                  disabled={
                    assignmentSaving
                  }
                >
                  {assignmentSaving
                    ? "Saving..."
                    : "Save Assignment"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* =====================================================
          PERMANENT DELETE
      ===================================================== */}

      <PermanentDeleteModal
        isOpen={Boolean(
          deleteTarget
        )}
        onClose={
          closeDeleteStaff
        }
        onConfirm={
          permanentlyDeleteStaff
        }
        recordType="staff member"
        recordName={
          deleteTarget?.name || ""
        }
        details={[
          {
            label:
              "Staff ID",
            value:
              deleteTarget?.staffId ||
              "—",
          },
          {
            label:
              "Email",
            value:
              deleteTarget?.email ||
              "—",
          },
          {
            label:
              "Hostel",
            value:
              deleteTarget?.hostel
                ?.name ||
              "Unassigned",
          },
          {
            label:
              "Mess Unit",
            value:
              deleteTarget?.messUnit
                ?.name ||
              "Unassigned",
          },
          {
            label:
              "Role",
            value:
              deleteTarget?.staffRole ||
              "Mess Staff",
          },
        ]}
        relatedItems={[
          "Staff profile and login account",
          "Hostel, block and mess-unit assignment",
          "Supervisor assignment will be cleared if this Staff member supervises a Mess Unit",
          "Other records directly owned by this Staff member",
        ]}
        warningMessage="Deleting this Staff member permanently removes the Staff account and directly owned Staff data. The Hostel, Mess Unit, students, menus and shared operational records will not be deleted."
        deleteButtonText="Permanently Delete Staff"
        error={
          deleteError
        }
        isDeleting={
          deleteSaving
        }
      />


      {/* =====================================================
          STATUS CONFIRMATION
      ===================================================== */}

      {statusTarget && (
        <div className="staff-modal-backdrop">

          <div className="staff-confirm-modal">

            <div
              className={`staff-confirm-icon ${
                normalizeStatus(
                  statusTarget.status
                ) === "active"
                  ? "warning"
                  : "success"
              }`}
            >
              {normalizeStatus(
                statusTarget.status
              ) === "active" ? (
                <AlertTriangle
                  size={24}
                />
              ) : (
                <CheckCircle2
                  size={24}
                />
              )}
            </div>


            <h2>
              {normalizeStatus(
                statusTarget.status
              ) === "active"
                ? "Deactivate Staff?"
                : "Activate Staff?"}
            </h2>


            <p>
              {normalizeStatus(
                statusTarget.status
              ) === "active"
                ? "This Staff member will not be able to sign in until the account is activated again."
                : "This Staff member will be allowed to sign in again."}
            </p>


            <strong>
              {statusTarget.name}
            </strong>


            <div className="staff-modal-actions">

              <button
                type="button"
                className="staff-secondary-button"
                onClick={() =>
                  setStatusTarget(
                    null
                  )
                }
                disabled={
                  statusSaving
                }
              >
                Cancel
              </button>


              <button
                type="button"
                className={
                  normalizeStatus(
                    statusTarget.status
                  ) === "active"
                    ? "staff-danger-button"
                    : "staff-primary-button"
                }
                onClick={
                  confirmStatusChange
                }
                disabled={
                  statusSaving
                }
              >
                {statusSaving
                  ? "Saving..."
                  : normalizeStatus(
                      statusTarget.status
                    ) === "active"
                  ? "Deactivate"
                  : "Activate"}
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}


export default Staff;