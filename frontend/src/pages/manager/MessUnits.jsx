import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useManager,
} from "../../context/ManagerContext";

import "./messUnits.css";


const EMPTY_FORM = {
  name: "",
  hostelId: "",
  blockId: "",
  unitType: "other",
  supportedCategories: "both",
  capacity: "",
  supervisorUserId: "",
  status: "active",
};


function normalizeStatus(value) {
  return String(
    value || "active"
  )
    .trim()
    .toLowerCase();
}


function readableType(value) {
  const type = String(
    value || ""
  ).toLowerCase();

  if (type === "north") {
    return "North Mess";
  }

  if (type === "south") {
    return "South Mess";
  }

  return "Other";
}


function readableCategory(value) {
  const category = String(
    value || ""
  ).toLowerCase();

  if (category === "veg") {
    return "Veg";
  }

  if (category === "non-veg") {
    return "Non-Veg";
  }

  return "Veg & Non-Veg";
}


function MessUnits() {
  const {
    apiFetch,
    hostels,
    loadFilterOptions,
    invalidateManagerData,
  } = useManager();


  /* =========================================================
     DATA
  ========================================================= */

  const [
    messUnits,
    setMessUnits,
  ] = useState([]);


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
    hostelFilter,
    setHostelFilter,
  ] = useState("all");


  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");


  const [
    search,
    setSearch,
  ] = useState("");


  /* =========================================================
     VIEW MODAL
  ========================================================= */

  const [
    viewingMess,
    setViewingMess,
  ] = useState(null);


  /* =========================================================
     ADD MODAL
  ========================================================= */

  const [
    addOpen,
    setAddOpen,
  ] = useState(false);


  const [
    form,
    setForm,
  ] = useState({
    ...EMPTY_FORM,
  });


  const [
    blocks,
    setBlocks,
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
     LOAD MESS UNITS
  ========================================================= */

  const loadMessUnits =
    useCallback(async () => {
      setLoading(true);
      setError("");


      try {
        const data =
          await apiFetch(
            "/api/manager/mess-units"
          );


        setMessUnits(
          Array.isArray(
            data.messUnits
          )
            ? data.messUnits
            : []
        );
      } catch (loadError) {
        console.error(
          "Mess Units loading error:",
          loadError
        );


        setError(
          loadError.message ||
            "Unable to load Mess Units."
        );
      } finally {
        setLoading(false);
      }
    }, [apiFetch]);


  /* =========================================================
     LOAD STAFF FOR SUPERVISOR SELECTOR
  ========================================================= */

  const loadStaff =
    useCallback(async () => {
      try {
        const data =
          await apiFetch(
            "/api/manager/staff?page=1&limit=500"
          );


        const receivedStaff =
          Array.isArray(
            data.staff
          )
            ? data.staff
            : Array.isArray(
                data.users
              )
            ? data.users
            : [];


        setStaff(
          receivedStaff
        );
      } catch (staffError) {
        console.error(
          "Unable to load Mess Staff:",
          staffError
        );


        setStaff([]);
      }
    }, [apiFetch]);


  useEffect(() => {
    loadMessUnits();
    loadStaff();
  }, [
    loadMessUnits,
    loadStaff,
  ]);


  /* =========================================================
     FILTERED DATA
  ========================================================= */

  const filteredMessUnits =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();


      return messUnits.filter(
        (mess) => {
          const hostelId =
            mess.hostel?.id ??
            mess.hostelId ??
            mess.hostel_id;


          const matchesHostel =
            hostelFilter ===
              "all" ||
            String(
              hostelId
            ) ===
              String(
                hostelFilter
              );


          const matchesStatus =
            statusFilter ===
              "all" ||
            normalizeStatus(
              mess.status
            ) ===
              statusFilter;


          const matchesSearch =
            !term ||
            String(
              mess.name || ""
            )
              .toLowerCase()
              .includes(term) ||
            String(
              mess.hostel?.name ||
                ""
            )
              .toLowerCase()
              .includes(term);


          return (
            matchesHostel &&
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      messUnits,
      hostelFilter,
      statusFilter,
      search,
    ]);


  /* =========================================================
     TOTALS
  ========================================================= */

  const totals =
    useMemo(() => {
      return messUnits.reduce(
        (
          result,
          mess
        ) => {
          result.total += 1;


          if (
            normalizeStatus(
              mess.status
            ) === "active"
          ) {
            result.active += 1;
          }


          result.students +=
            Number(
              mess.assignedStudents ||
                0
            );


          result.capacity +=
            Number(
              mess.capacity ||
                0
            );


          return result;
        },
        {
          total: 0,
          active: 0,
          students: 0,
          capacity: 0,
        }
      );
    }, [messUnits]);


  /* =========================================================
     FILTER RESET
  ========================================================= */

  const clearFilters = () => {
    setHostelFilter("all");
    setStatusFilter("all");
    setSearch("");
  };


  /* =========================================================
     OPEN ADD
  ========================================================= */

  const openAddMessUnit = () => {
    setForm({
      ...EMPTY_FORM,
      hostelId:
        hostels.length === 1
          ? String(
              hostels[0].id
            )
          : "",
    });

    setBlocks([]);
    setFormError("");
    setSuccessMessage("");
    setAddOpen(true);
  };


  const closeAddModal = () => {
    if (saving) {
      return;
    }

    setAddOpen(false);
    setFormError("");
  };


  /* =========================================================
     NORMAL FORM CHANGE
  ========================================================= */

  const handleFieldChange =
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


  /* =========================================================
     HOSTEL CHANGE
  ========================================================= */

  const handleHostelChange =
    async (event) => {
      const hostelId =
        event.target.value;


      setForm(
        (current) => ({
          ...current,
          hostelId,
          blockId: "",
          supervisorUserId: "",
        })
      );


      setBlocks([]);


      if (!hostelId) {
        return;
      }


      try {
        const data =
          await apiFetch(
            `/api/manager/hostels/${hostelId}/blocks`
          );


        setBlocks(
          Array.isArray(
            data.blocks
          )
            ? data.blocks
            : []
        );
      } catch (blockError) {
        console.error(
          "Blocks loading error:",
          blockError
        );


        setBlocks([]);
      }
    };


  /* =========================================================
     SUPERVISOR OPTIONS
  ========================================================= */

  const supervisorOptions =
    useMemo(() => {
      if (!form.hostelId) {
        return [];
      }


      return staff.filter(
        (person) => {
          const hostelId =
            person.hostelId ??
            person.hostel_id ??
            person.hostel?.id;


          return (
            String(
              hostelId
            ) ===
            String(
              form.hostelId
            )
          );
        }
      );
    }, [
      staff,
      form.hostelId,
    ]);


  /* =========================================================
     VALIDATE
  ========================================================= */

  const validateForm = () => {
    if (!form.name.trim()) {
      return (
        "Please enter the Mess Unit name."
      );
    }


    if (!form.hostelId) {
      return (
        "Please select a Hostel."
      );
    }


    if (!form.unitType) {
      return (
        "Please select the Mess Unit type."
      );
    }


    if (
      form.capacity &&
      (
        Number.isNaN(
          Number(
            form.capacity
          )
        ) ||
        Number(
          form.capacity
        ) <= 0
      )
    ) {
      return (
        "Capacity must be greater than zero."
      );
    }


    const duplicate =
      messUnits.some(
        (mess) =>
          String(
            mess.hostel?.id ??
              mess.hostelId ??
              mess.hostel_id
          ) ===
            String(
              form.hostelId
            ) &&
          String(
            mess.name || ""
          )
            .trim()
            .toLowerCase() ===
            form.name
              .trim()
              .toLowerCase()
      );


    if (duplicate) {
      return (
        "A Mess Unit with this name already exists in the selected Hostel."
      );
    }


    return "";
  };


  /* =========================================================
     CREATE MESS UNIT
  ========================================================= */

  const createMessUnit =
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
      setSuccessMessage("");


      try {
        const response =
          await apiFetch(
            "/api/manager/mess-units",
            {
              method: "POST",

              body:
                JSON.stringify({
                  name:
                    form.name.trim(),

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

                  unitType:
                    form.unitType,

                  supportedCategories:
                    form.supportedCategories,

                  capacity:
                    form.capacity
                      ? Number(
                          form.capacity
                        )
                      : null,

                  supervisorUserId:
                    form.supervisorUserId
                      ? Number(
                          form.supervisorUserId
                        )
                      : null,

                  status:
                    form.status,
                }),
            }
          );


        setAddOpen(false);


        setSuccessMessage(
          response.message ||
            "Mess unit added successfully."
        );


        await loadMessUnits();

        await loadFilterOptions();


        if (
          invalidateManagerData
        ) {
          await invalidateManagerData({
            refreshFilters: true,
            refreshNotifications: true,
          });
        }
      } catch (saveError) {
        console.error(
          "Mess Unit save error:",
          saveError
        );


        setFormError(
          saveError.message ||
            "Unable to create Mess Unit."
        );
      } finally {
        setSaving(false);
      }
    };


  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="mess-units-loading">

        <RefreshCw
          size={25}
          className="mess-units-spin"
        />

        <span>
          Loading Mess Units...
        </span>

      </div>
    );
  }


  return (
    <div className="mess-units-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mess-units-page-header">

        <div>
          <span className="mess-units-eyebrow">
            MESS MANAGEMENT
          </span>

          <h1>
            Mess Units
          </h1>

          <p>
            View and manage Hostel Mess Units.
          </p>
        </div>


        <button
          type="button"
          className="mess-primary-button"
          onClick={
            openAddMessUnit
          }
          disabled={
            hostels.length === 0
          }
        >
          <Plus size={17} />

          Add Mess Unit
        </button>

      </div>


      {/* =====================================================
          INFO NOTE
      ===================================================== */}

      <div className="mess-units-info-note">

        <UtensilsCrossed
          size={18}
        />

        <div>
          <strong>
            Default Mess Units
          </strong>

          <span>
            North Mess and South Mess are created
            automatically whenever a new Hostel is added.
            Use Add Mess Unit only when an additional
            custom Mess Unit is required.
          </span>
        </div>

      </div>


      {/* =====================================================
          SUCCESS
      ===================================================== */}

      {successMessage && (
        <div className="mess-success-message">

          <CheckCircle2
            size={18}
          />

          <span>
            {successMessage}
          </span>


          <button
            type="button"
            onClick={() =>
              setSuccessMessage(
                ""
              )
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
        <div className="mess-error-message">

          <AlertTriangle
            size={18}
          />

          <div>
            <strong>
              Unable to load Mess Units
            </strong>

            <span>
              {error}
            </span>
          </div>


          <button
            type="button"
            onClick={
              loadMessUnits
            }
          >
            Retry
          </button>

        </div>
      )}


      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section className="mess-summary-grid">

        <article className="mess-summary-card">

          <div className="mess-summary-icon">
            <UtensilsCrossed
              size={20}
            />
          </div>

          <div>
            <span>
              Total Mess Units
            </span>

            <strong>
              {totals.total}
            </strong>
          </div>

        </article>


        <article className="mess-summary-card">

          <div className="mess-summary-icon green">
            <CheckCircle2
              size={20}
            />
          </div>

          <div>
            <span>
              Active Mess Units
            </span>

            <strong>
              {totals.active}
            </strong>
          </div>

        </article>


        <article className="mess-summary-card">

          <div className="mess-summary-icon blue">
            <Users size={20} />
          </div>

          <div>
            <span>
              Assigned Students
            </span>

            <strong>
              {totals.students}
            </strong>
          </div>

        </article>


        <article className="mess-summary-card">

          <div className="mess-summary-icon orange">
            <Building2
              size={20}
            />
          </div>

          <div>
            <span>
              Total Capacity
            </span>

            <strong>
              {totals.capacity}
            </strong>
          </div>

        </article>

      </section>


      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section className="mess-filter-card">

        <div className="mess-search-box">

          <Search size={16} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search Mess Unit or Hostel"
          />

        </div>


        <div className="mess-filter-field">

          <label>
            Hostel
          </label>

          <select
            value={
              hostelFilter
            }
            onChange={(event) =>
              setHostelFilter(
                event.target.value
              )
            }
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


        <div className="mess-filter-field">

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
          className="mess-clear-button"
          onClick={
            clearFilters
          }
          disabled={
            !search &&
            hostelFilter ===
              "all" &&
            statusFilter ===
              "all"
          }
        >
          Clear Filters
        </button>

      </section>


      {/* =====================================================
          EMPTY
      ===================================================== */}

      {filteredMessUnits.length ===
      0 ? (

        <div className="mess-empty-state">

          <UtensilsCrossed
            size={38}
          />

          <h2>
            No Mess Units found
          </h2>

          <p>
            {messUnits.length === 0
              ? "Add a Hostel first. North Mess and South Mess will be created automatically."
              : "No Mess Unit matches the selected filters."}
          </p>

        </div>

      ) : (

        /* ===================================================
           CARDS
        =================================================== */

        <section className="mess-unit-card-grid">

          {filteredMessUnits.map(
            (mess) => {

              const active =
                normalizeStatus(
                  mess.status
                ) === "active";


              return (
                <article
                  key={
                    mess.id
                  }
                  className="mess-unit-card"
                >

                  <div className="mess-unit-card-header">

                    <div className="mess-unit-title-wrapper">

                      <div className="mess-unit-icon">
                        <UtensilsCrossed
                          size={21}
                        />
                      </div>


                      <div>
                        <span>
                          {readableType(
                            mess.unitType
                          )}
                        </span>

                        <h2>
                          {mess.name}
                        </h2>
                      </div>

                    </div>


                    <span
                      className={`mess-status-badge ${
                        active
                          ? "active"
                          : "inactive"
                      }`}
                    >
                      {active
                        ? "Active"
                        : "Inactive"}
                    </span>

                  </div>


                  <div className="mess-unit-hostel">

                    <Building2
                      size={15}
                    />

                    <div>
                      <span>
                        Hostel
                      </span>

                      <strong>
                        {mess.hostel?.name ||
                          "—"}
                      </strong>
                    </div>

                  </div>


                  <div className="mess-unit-details-grid">

                    <div>
                      <span>
                        Block
                      </span>

                      <strong>
                        {mess.block?.name ||
                          "All Blocks"}
                      </strong>
                    </div>


                    <div>
                      <span>
                        Capacity
                      </span>

                      <strong>
                        {mess.capacity ??
                          "—"}
                      </strong>
                    </div>


                    <div>
                      <span>
                        Students
                      </span>

                      <strong>
                        {Number(
                          mess.assignedStudents ||
                            0
                        )}
                      </strong>
                    </div>


                    <div>
                      <span>
                        Category
                      </span>

                      <strong>
                        {readableCategory(
                          mess.supportedCategories
                        )}
                      </strong>
                    </div>

                  </div>


                  <div className="mess-unit-info-row">

                    <span>
                      Supervisor
                    </span>

                    <strong>
                      {mess.supervisor?.name ||
                        "Not assigned"}
                    </strong>

                  </div>


                  <div className="mess-unit-info-row">

                    <span>
                      Current Menu
                    </span>

                    <strong>
                      {mess.currentMenu ||
                        "No menu published"}
                    </strong>

                  </div>


                  <div className="mess-unit-card-actions">

                    <button
                      type="button"
                      className="mess-secondary-button"
                      onClick={() =>
                        setViewingMess(
                          mess
                        )
                      }
                    >
                      <Eye size={15} />

                      View
                    </button>

                  </div>

                </article>
              );
            }
          )}

        </section>
      )}


      {/* =====================================================
          ADD MESS UNIT MODAL
      ===================================================== */}

      {addOpen && (
        <div className="mess-modal-backdrop">

          <div className="mess-modal">

            <div className="mess-modal-header">

              <div>
                <h2>
                  Add Mess Unit
                </h2>

                <p>
                  Create an additional Mess Unit for an
                  existing Hostel.
                </p>
              </div>


              <button
                type="button"
                className="mess-modal-close"
                onClick={
                  closeAddModal
                }
              >
                <X size={20} />
              </button>

            </div>


            <form
              className="mess-form"
              onSubmit={
                createMessUnit
              }
            >

              {formError && (
                <div className="mess-form-error">

                  <AlertTriangle
                    size={17}
                  />

                  <span>
                    {formError}
                  </span>

                </div>
              )}


              <div className="mess-form-grid">

                <div className="mess-form-field">

                  <label>
                    Mess Unit Name
                  </label>

                  <input
                    name="name"
                    value={
                      form.name
                    }
                    onChange={
                      handleFieldChange
                    }
                    placeholder="Example: Special Mess"
                  />

                </div>


                <div className="mess-form-field">

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


                <div className="mess-form-field">

                  <label>
                    Block
                  </label>

                  <select
                    name="blockId"
                    value={
                      form.blockId
                    }
                    onChange={
                      handleFieldChange
                    }
                    disabled={
                      !form.hostelId
                    }
                  >
                    <option value="">
                      All Blocks / No specific Block
                    </option>

                    {blocks.map(
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


                <div className="mess-form-field">

                  <label>
                    Mess Unit Type
                  </label>

                  <select
                    name="unitType"
                    value={
                      form.unitType
                    }
                    onChange={
                      handleFieldChange
                    }
                  >
                    <option value="north">
                      North
                    </option>

                    <option value="south">
                      South
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>

                </div>


                <div className="mess-form-field">

                  <label>
                    Supported Category
                  </label>

                  <select
                    name="supportedCategories"
                    value={
                      form.supportedCategories
                    }
                    onChange={
                      handleFieldChange
                    }
                  >
                    <option value="both">
                      Veg & Non-Veg
                    </option>

                    <option value="veg">
                      Veg
                    </option>

                    <option value="non-veg">
                      Non-Veg
                    </option>
                  </select>

                </div>


                <div className="mess-form-field">

                  <label>
                    Capacity
                  </label>

                  <input
                    type="number"
                    min="1"
                    name="capacity"
                    value={
                      form.capacity
                    }
                    onChange={
                      handleFieldChange
                    }
                    placeholder="Example: 300"
                  />

                </div>


                <div className="mess-form-field">

                  <label>
                    Supervisor
                  </label>

                  <select
                    name="supervisorUserId"
                    value={
                      form.supervisorUserId
                    }
                    onChange={
                      handleFieldChange
                    }
                    disabled={
                      !form.hostelId
                    }
                  >
                    <option value="">
                      Not assigned
                    </option>

                    {supervisorOptions.map(
                      (person) => (
                        <option
                          key={
                            person.id
                          }
                          value={
                            person.id
                          }
                        >
                          {person.name}
                        </option>
                      )
                    )}
                  </select>

                </div>


                <div className="mess-form-field">

                  <label>
                    Status
                  </label>

                  <select
                    name="status"
                    value={
                      form.status
                    }
                    onChange={
                      handleFieldChange
                    }
                  >
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>

                </div>

              </div>


              <div className="mess-modal-actions">

                <button
                  type="button"
                  className="mess-secondary-button"
                  onClick={
                    closeAddModal
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="mess-primary-button"
                  disabled={
                    saving
                  }
                >
                  {saving ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="mess-units-spin"
                      />

                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />

                      Create Mess Unit
                    </>
                  )}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* =====================================================
          VIEW MESS MODAL
      ===================================================== */}

      {viewingMess && (
        <div className="mess-modal-backdrop">

          <div className="mess-modal mess-view-modal">

            <div className="mess-modal-header">

              <div>
                <span className="mess-units-eyebrow">
                  MESS UNIT DETAILS
                </span>

                <h2>
                  {viewingMess.name}
                </h2>

                <p>
                  {viewingMess.hostel?.name}
                </p>
              </div>


              <button
                type="button"
                className="mess-modal-close"
                onClick={() =>
                  setViewingMess(
                    null
                  )
                }
              >
                <X size={20} />
              </button>

            </div>


            <div className="mess-view-content">

              <div className="mess-view-row">
                <span>
                  Status
                </span>

                <strong>
                  {normalizeStatus(
                    viewingMess.status
                  ) === "active"
                    ? "Active"
                    : "Inactive"}
                </strong>
              </div>


              <div className="mess-view-row">
                <span>
                  Type
                </span>

                <strong>
                  {readableType(
                    viewingMess.unitType
                  )}
                </strong>
              </div>


              <div className="mess-view-row">
                <span>
                  Hostel
                </span>

                <strong>
                  {viewingMess.hostel?.name ||
                    "—"}
                </strong>
              </div>


              <div className="mess-view-row">
                <span>
                  Block
                </span>

                <strong>
                  {viewingMess.block?.name ||
                    "All Blocks"}
                </strong>
              </div>


              <div className="mess-view-row">
                <span>
                  Capacity
                </span>

                <strong>
                  {viewingMess.capacity ??
                    "—"}
                </strong>
              </div>


              <div className="mess-view-row">
                <span>
                  Assigned Students
                </span>

                <strong>
                  {Number(
                    viewingMess.assignedStudents ||
                      0
                  )}
                </strong>
              </div>


              <div className="mess-view-row">
                <span>
                  Supported Category
                </span>

                <strong>
                  {readableCategory(
                    viewingMess.supportedCategories
                  )}
                </strong>
              </div>


              <div className="mess-view-row">
                <span>
                  Supervisor
                </span>

                <strong>
                  {viewingMess.supervisor?.name ||
                    "Not assigned"}
                </strong>
              </div>


              <div className="mess-modal-actions">

                <button
                  type="button"
                  className="mess-secondary-button"
                  onClick={() =>
                    setViewingMess(
                      null
                    )
                  }
                >
                  Close
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}


export default MessUnits;