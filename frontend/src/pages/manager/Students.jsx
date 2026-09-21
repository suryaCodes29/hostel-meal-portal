import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
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

import "./students.css";


const PAGE_SIZE = 10;


const EMPTY_STUDENT_FORM = {
  name: "",
  email: "",
  mobile: "",
  hostelId: "",
  blockId: "",
  messUnitId: "",
  mealCategory: "veg",
};


const EMPTY_ASSIGNMENT_FORM = {
  hostelId: "",
  blockId: "",
  messUnitId: "",
  mealCategory: "veg",
};


function Students() {
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
    students,
    setStudents,
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


  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });


  /* =========================================================
     FILTERS
  ========================================================= */

  const [
    hostelFilter,
    setHostelFilter,
  ] = useState("all");


  const [
    blockFilter,
    setBlockFilter,
  ] = useState("all");


  const [
    messFilter,
    setMessFilter,
  ] = useState("all");


  const [
    mealCategoryFilter,
    setMealCategoryFilter,
  ] = useState("all");


  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");


  const [
    search,
    setSearch,
  ] = useState("");


  const [
    blocks,
    setBlocks,
  ] = useState([]);


  /* =========================================================
     ADD STUDENT
  ========================================================= */

  const [
    addOpen,
    setAddOpen,
  ] = useState(false);


  const [
    addForm,
    setAddForm,
  ] = useState({
    ...EMPTY_STUDENT_FORM,
  });


  const [
    addBlocks,
    setAddBlocks,
  ] = useState([]);


  const [
    addError,
    setAddError,
  ] = useState("");


  const [
    addSaving,
    setAddSaving,
  ] = useState(false);


  /* =========================================================
     VIEW STUDENT
  ========================================================= */

  const [
    viewingStudent,
    setViewingStudent,
  ] = useState(null);


  /* =========================================================
     ASSIGN / REASSIGN
  ========================================================= */

  const [
    assigningStudent,
    setAssigningStudent,
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
     STATUS CONFIRMATION
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
     QUERY STRING
  ========================================================= */

  const buildQueryString =
    useCallback(
      (pageNumber) => {
        const params =
          new URLSearchParams();


        params.set(
          "page",
          String(pageNumber)
        );


        params.set(
          "limit",
          String(PAGE_SIZE)
        );


        if (
          hostelFilter !==
          "all"
        ) {
          params.set(
            "hostel_id",
            hostelFilter
          );
        }


        if (
          blockFilter !==
          "all"
        ) {
          params.set(
            "block_id",
            blockFilter
          );
        }


        if (
          messFilter !==
          "all"
        ) {
          params.set(
            "mess_unit_id",
            messFilter
          );
        }


        if (
          mealCategoryFilter !==
          "all"
        ) {
          params.set(
            "meal_category",
            mealCategoryFilter
          );
        }


        if (
          statusFilter !==
          "all"
        ) {
          params.set(
            "status",
            statusFilter
          );
        }


        if (
          search.trim()
        ) {
          params.set(
            "search",
            search.trim()
          );
        }


        return (
          params.toString()
        );
      },
      [
        hostelFilter,
        blockFilter,
        messFilter,
        mealCategoryFilter,
        statusFilter,
        search,
      ]
    );


  /* =========================================================
     LOAD STUDENTS
  ========================================================= */

  const loadStudents =
    useCallback(
      async (
        pageNumber = 1
      ) => {
        setLoading(true);

        setError("");


        try {
          const query =
            buildQueryString(
              pageNumber
            );


          const data =
            await apiFetch(
              `/api/manager/students?${query}`
            );


          setStudents(
            Array.isArray(
              data.students
            )
              ? data.students
              : []
          );


          setPagination({
            page:
              Number(
                data.pagination
                  ?.page || 1
              ),

            limit:
              Number(
                data.pagination
                  ?.limit ||
                  PAGE_SIZE
              ),

            total:
              Number(
                data.pagination
                  ?.total || 0
              ),

            pages:
              Math.max(
                Number(
                  data.pagination
                    ?.pages || 1
                ),
                1
              ),
          });
        } catch (loadError) {
          console.error(
            "Students loading error:",
            loadError
          );


          setError(
            loadError.message ||
              "Unable to load Students."
          );


          setStudents([]);
        } finally {
          setLoading(false);
        }
      },
      [
        apiFetch,
        buildQueryString,
      ]
    );


  useEffect(() => {
    loadStudents(1);
  }, [loadStudents]);


  /* =========================================================
     FILTER HOSTEL -> BLOCKS
  ========================================================= */

  useEffect(() => {
    const loadBlocks =
      async () => {
        if (
          hostelFilter ===
          "all"
        ) {
          setBlocks([]);

          setBlockFilter(
            "all"
          );

          return;
        }


        try {
          const data =
            await apiFetch(
              `/api/manager/hostels/${hostelFilter}/blocks`
            );


          setBlocks(
            Array.isArray(
              data.blocks
            )
              ? data.blocks
              : []
          );
        } catch {
          setBlocks([]);
        }
      };


    loadBlocks();
  }, [
    apiFetch,
    hostelFilter,
  ]);


  /* =========================================================
     PAGE-SPECIFIC MESS OPTIONS
  ========================================================= */

  const filterMessUnits =
    useMemo(() => {
      if (
        hostelFilter ===
        "all"
      ) {
        return messUnits;
      }


      return messUnits.filter(
        (mess) =>
          String(
            mess.hostelId ??
              mess.hostel?.id
          ) ===
          String(
            hostelFilter
          )
      );
    }, [
      messUnits,
      hostelFilter,
    ]);


  useEffect(() => {
    if (
      messFilter ===
      "all"
    ) {
      return;
    }


    const valid =
      filterMessUnits.some(
        (mess) =>
          String(
            mess.id
          ) ===
          String(
            messFilter
          )
      );


    if (!valid) {
      setMessFilter(
        "all"
      );
    }
  }, [
    filterMessUnits,
    messFilter,
  ]);


  /* =========================================================
     CLEAR FILTERS
  ========================================================= */

  const clearFilters = () => {
    setHostelFilter("all");

    setBlockFilter("all");

    setMessFilter("all");

    setMealCategoryFilter(
      "all"
    );

    setStatusFilter("all");

    setSearch("");
  };


  /* =========================================================
     ADD STUDENT HELPERS
  ========================================================= */

  const openAddStudent = () => {
    setAddForm({
      ...EMPTY_STUDENT_FORM,
    });

    setAddBlocks([]);

    setAddError("");

    setSuccessMessage("");

    setAddOpen(true);
  };


  const closeAddStudent = () => {
    if (addSaving) {
      return;
    }


    setAddOpen(false);

    setAddError("");
  };


  const handleAddFieldChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;


      setAddForm(
        (current) => ({
          ...current,
          [name]: value,
        })
      );
    };


  const handleAddHostelChange =
    async (event) => {
      const hostelId =
        event.target.value;


      setAddForm(
        (current) => ({
          ...current,

          hostelId,

          blockId: "",

          messUnitId: "",
        })
      );


      setAddBlocks([]);


      if (!hostelId) {
        return;
      }


      try {
        const data =
          await apiFetch(
            `/api/manager/hostels/${hostelId}/blocks`
          );


        setAddBlocks(
          Array.isArray(
            data.blocks
          )
            ? data.blocks
            : []
        );
      } catch {
        setAddBlocks([]);
      }
    };


  const addMessOptions =
    useMemo(() => {
      if (
        !addForm.hostelId
      ) {
        return [];
      }


      return messUnits.filter(
        (mess) =>
          String(
            mess.hostelId ??
              mess.hostel?.id
          ) ===
          String(
            addForm.hostelId
          )
      );
    }, [
      messUnits,
      addForm.hostelId,
    ]);


  /* =========================================================
     CREATE STUDENT
  ========================================================= */

  const validateAddForm = () => {
    if (
      !addForm.name.trim()
    ) {
      return (
        "Please enter the Student name."
      );
    }


    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        addForm.email.trim()
      )
    ) {
      return (
        "Please enter a valid email address."
      );
    }


    if (
      !/^[6-9]\d{9}$/.test(
        addForm.mobile.trim()
      )
    ) {
      return (
        "Please enter a valid 10-digit mobile number."
      );
    }


    if (
      !addForm.hostelId
    ) {
      return (
        "Please select a Hostel."
      );
    }


    if (
      !addForm.messUnitId
    ) {
      return (
        "Please select a Mess Unit."
      );
    }


    return "";
  };


  const createStudent =
    async (event) => {
      event.preventDefault();


      const validationError =
        validateAddForm();


      if (
        validationError
      ) {
        setAddError(
          validationError
        );

        return;
      }


      setAddSaving(true);

      setAddError("");


      try {
        const response =
          await apiFetch(
            "/api/manager/students",
            {
              method: "POST",

              body:
                JSON.stringify({
                  name:
                    addForm.name.trim(),

                  email:
                    addForm.email
                      .trim()
                      .toLowerCase(),

                  mobile:
                    addForm.mobile
                      .trim(),

                  hostelId:
                    Number(
                      addForm.hostelId
                    ),

                  blockId:
                    addForm.blockId
                      ? Number(
                          addForm.blockId
                        )
                      : null,

                  messUnitId:
                    Number(
                      addForm.messUnitId
                    ),

                  mealCategory:
                    addForm.mealCategory,
                }),
            }
          );


        setAddOpen(false);


        setSuccessMessage(
          response.message ||
            "Student added successfully."
        );


        await loadStudents(1);


        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      } catch (saveError) {
        setAddError(
          saveError.message ||
            "Unable to create Student."
        );
      } finally {
        setAddSaving(false);
      }
    };


  /* =========================================================
     ASSIGNMENT
  ========================================================= */

  const openAssignment =
    async (student) => {
      const hostelId =
        student.hostel?.id
          ? String(
              student.hostel.id
            )
          : "";


      setAssigningStudent(
        student
      );


      setAssignmentForm({
        hostelId,

        blockId:
          student.block?.id
            ? String(
                student.block.id
              )
            : "",

        messUnitId:
          student.messUnit?.id
            ? String(
                student.messUnit.id
              )
            : "",

        mealCategory:
          student.mealCategory ||
          "veg",
      });


      setAssignmentBlocks([]);

      setAssignmentError("");


      if (hostelId) {
        try {
          const data =
            await apiFetch(
              `/api/manager/hostels/${hostelId}/blocks`
            );


          setAssignmentBlocks(
            Array.isArray(
              data.blocks
            )
              ? data.blocks
              : []
          );
        } catch {
          setAssignmentBlocks([]);
        }
      }
    };


  const assignmentMessOptions =
    useMemo(() => {
      if (
        !assignmentForm.hostelId
      ) {
        return [];
      }


      return messUnits.filter(
        (mess) =>
          String(
            mess.hostelId ??
              mess.hostel?.id
          ) ===
          String(
            assignmentForm
              .hostelId
          )
      );
    }, [
      messUnits,
      assignmentForm.hostelId,
    ]);


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


      setAssignmentBlocks([]);


      if (!hostelId) {
        return;
      }


      try {
        const data =
          await apiFetch(
            `/api/manager/hostels/${hostelId}/blocks`
          );


        setAssignmentBlocks(
          Array.isArray(
            data.blocks
          )
            ? data.blocks
            : []
        );
      } catch {
        setAssignmentBlocks([]);
      }
    };


  const saveAssignment =
    async (event) => {
      event.preventDefault();


      if (
        !assigningStudent
      ) {
        return;
      }


      if (
        !assignmentForm
          .hostelId ||
        !assignmentForm
          .messUnitId ||
        !assignmentForm
          .mealCategory
      ) {
        setAssignmentError(
          "Hostel, Mess Unit and Meal Category are required."
        );

        return;
      }


      setAssignmentSaving(
        true
      );

      setAssignmentError(
        ""
      );


      try {
        const response =
          await apiFetch(
            `/api/manager/students/${assigningStudent.id}/assign`,
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

                  mealCategory:
                    assignmentForm
                      .mealCategory,
                }),
            }
          );


        setAssigningStudent(
          null
        );


        setSuccessMessage(
          response.message ||
            "Student assigned successfully."
        );


        await loadStudents(
          pagination.page
        );


        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      } catch (
        assignError
      ) {
        setAssignmentError(
          assignError.message ||
            "Unable to assign Student."
        );
      } finally {
        setAssignmentSaving(
          false
        );
      }
    };


  /* =========================================================
     STATUS
  ========================================================= */

  const changeStudentStatus =
    async () => {
      if (!statusTarget) {
        return;
      }


      const nextActive =
        statusTarget.status !==
        "active";


      setStatusSaving(
        true
      );


      try {
        const response =
          await apiFetch(
            `/api/manager/students/${statusTarget.id}/status`,
            {
              method: "PATCH",

              body:
                JSON.stringify({
                  isActive:
                    nextActive,
                }),
            }
          );


        setStatusTarget(
          null
        );


        setSuccessMessage(
          response.message
        );


        await loadStudents(
          pagination.page
        );


        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      } catch (statusError) {
        setError(
          statusError.message ||
            "Unable to change Student status."
        );
      } finally {
        setStatusSaving(
          false
        );
      }
    };


  /* =========================================================
     PERMANENT DELETE
  ========================================================= */

  const openDeleteStudent =
    (student) => {
      if (!student) {
        return;
      }

      setDeleteError("");
      setSuccessMessage("");
      setDeleteTarget(student);
    };


  const closeDeleteStudent = () => {
    if (deleteSaving) {
      return;
    }

    setDeleteError("");
    setDeleteTarget(null);
  };


  const permanentlyDeleteStudent =
    async (confirmation) => {
      if (!deleteTarget) {
        return;
      }

      const requestGuard =
        deleteRequestGuardRef.current;

      if (!requestGuard.tryStart()) {
        return;
      }

      const studentToDelete =
        deleteTarget;

      setDeleteSaving(true);
      setDeleteError("");

      try {
        const response =
          await apiFetch(
            `/api/manager/students/${studentToDelete.id}`,
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


        setStudents(
          (currentStudents) =>
            currentStudents.filter(
              (student) =>
                student.id !==
                studentToDelete.id
            )
        );


        setDeleteTarget(null);

        setSuccessMessage(
          response.message ||
            `${studentToDelete.name} deleted permanently.`
        );


        const pageToReload =
          students.length === 1 &&
          pagination.page > 1
            ? pagination.page - 1
            : pagination.page;


        await loadStudents(
          pageToReload
        );


        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      } catch (deleteRequestError) {
        setDeleteError(
          getPermanentDeleteErrorMessage(
            deleteRequestError,
            "Unable to permanently delete this Student."
          )
        );
      } finally {
        requestGuard.finish();

        setDeleteSaving(false);
      }
    };


  /* =========================================================
     PAGE NAVIGATION
  ========================================================= */

  const goToPage =
    (pageNumber) => {
      if (
        pageNumber < 1 ||
        pageNumber >
          pagination.pages
      ) {
        return;
      }


      loadStudents(
        pageNumber
      );
    };


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="students-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="students-header">

        <div>
          <span className="students-eyebrow">
            STUDENT MANAGEMENT
          </span>

          <h1>
            Students
          </h1>

          <p>
            View and manage all hostel students.
          </p>
        </div>


        <button
          type="button"
          className="students-primary-button"
          onClick={
            openAddStudent
          }
          disabled={
            hostels.length === 0
          }
        >
          <Plus size={17} />

          Add Student
        </button>

      </div>


      {successMessage && (
        <div className="students-success">

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


      {error && (
        <div className="students-error">

          <AlertTriangle
            size={18}
          />

          <div>
            <strong>
              Unable to load Students
            </strong>

            <span>
              {error}
            </span>
          </div>


          <button
            type="button"
            onClick={() =>
              loadStudents(
                pagination.page
              )
            }
          >
            Retry
          </button>

        </div>
      )}


      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section className="students-filter-card">

        <div className="students-search-box">

          <Search size={16} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search Student ID, name or email"
          />

        </div>


        <div className="students-filter-field">

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

              setBlockFilter(
                "all"
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


        <div className="students-filter-field">

          <label>
            Block
          </label>

          <select
            value={
              blockFilter
            }
            disabled={
              hostelFilter ===
              "all"
            }
            onChange={(event) =>
              setBlockFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Blocks
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


        <div className="students-filter-field">

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

            {filterMessUnits.map(
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


        <div className="students-filter-field">

          <label>
            Meal Category
          </label>

          <select
            value={
              mealCategoryFilter
            }
            onChange={(event) =>
              setMealCategoryFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All
            </option>

            <option value="veg">
              Veg
            </option>

            <option value="non-veg">
              Non-Veg
            </option>
          </select>

        </div>


        <div className="students-filter-field">

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
          className="students-clear-button"
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

      <section className="students-table-card">

        <div className="students-table-top">

          <div>
            <strong>
              Student Records
            </strong>

            <span>
              {pagination.total}
              {" "}
              total students
            </span>
          </div>

        </div>


        {loading ? (

          <div className="students-loading">

            <RefreshCw
              size={24}
              className="students-spin"
            />

            <span>
              Loading Students...
            </span>

          </div>

        ) : students.length ===
          0 ? (

          <div className="students-empty">

            <Users size={38} />

            <h2>
              No Students found
            </h2>

            <p>
              No Student records match the selected filters.
            </p>

          </div>

        ) : (

          <div className="students-table-wrapper">

            <table className="students-table">

              <thead>
                <tr>
                  <th>#</th>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Hostel</th>
                  <th>Block</th>
                  <th>Mess Unit</th>
                  <th>Meal Category</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>


              <tbody>

                {students.map(
                  (
                    student,
                    index
                  ) => (
                    <tr
                      key={
                        student.id
                      }
                    >

                      <td>
                        {(pagination.page -
                          1) *
                          pagination.limit +
                          index +
                          1}
                      </td>


                      <td>
                        <strong className="student-id">
                          {student.studentId ||
                            "—"}
                        </strong>
                      </td>


                      <td>
                        <div className="student-name-cell">

                          <div className="student-avatar">
                            <UserRound
                              size={15}
                            />
                          </div>

                          <span>
                            {student.name}
                          </span>

                        </div>
                      </td>


                      <td>
                        {student.email}
                      </td>


                      <td>
                        {student.hostel?.name ||
                          "Unassigned"}
                      </td>


                      <td>
                        {student.block?.name ||
                          "—"}
                      </td>


                      <td>
                        {student.messUnit?.name ||
                          "Unassigned"}
                      </td>


                      <td>
                        <span
                          className={`student-category ${
                            student.mealCategory ===
                            "non-veg"
                              ? "nonveg"
                              : "veg"
                          }`}
                        >
                          {student.mealCategory ===
                          "non-veg"
                            ? "Non-Veg"
                            : student.mealCategory ===
                              "veg"
                            ? "Veg"
                            : "—"}
                        </span>
                      </td>


                      <td>
                        <span
                          className={`student-status ${
                            student.status ===
                            "active"
                              ? "active"
                              : "inactive"
                          }`}
                        >
                          {student.status ===
                          "active"
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>


                      <td>
                        <div className="student-actions">

                          <button
                            type="button"
                            onClick={() =>
                              setViewingStudent(
                                student
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
                              openAssignment(
                                student
                              )
                            }
                          >
                            Assign
                          </button>


                          <button
                            type="button"
                            className={
                              student.status ===
                              "active"
                                ? "deactivate"
                                : "activate"
                            }
                            onClick={() =>
                              setStatusTarget(
                                student
                              )
                            }
                          >
                            {student.status ===
                            "active"
                              ? "Deactivate"
                              : "Activate"}
                          </button>


                          <button
                            type="button"
                            className="manager-delete-action"
                            onClick={() =>
                              openDeleteStudent(
                                student
                              )
                            }
                            title={`Delete ${student.name} permanently`}
                            aria-label={`Delete ${student.name} permanently`}
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


        <div className="students-pagination">

          <span>
            Page
            {" "}
            {pagination.page}
            {" "}
            of
            {" "}
            {pagination.pages}
          </span>


          <div>

            <button
              type="button"
              disabled={
                pagination.page <=
                1
              }
              onClick={() =>
                goToPage(
                  pagination.page -
                    1
                )
              }
            >
              <ChevronLeft
                size={16}
              />

              Previous
            </button>


            <button
              type="button"
              disabled={
                pagination.page >=
                pagination.pages
              }
              onClick={() =>
                goToPage(
                  pagination.page +
                    1
                )
              }
            >
              Next

              <ChevronRight
                size={16}
              />
            </button>

          </div>

        </div>

      </section>


      {/* =====================================================
          ADD STUDENT MODAL
      ===================================================== */}

      {addOpen && (
        <div className="students-modal-backdrop">

          <div className="students-modal">

            <div className="students-modal-header">

              <div>
                <h2>
                  Add Student
                </h2>

                <p>
                  Create a Student account and assign Hostel and Mess Unit.
                </p>
              </div>


              <button
                type="button"
                onClick={
                  closeAddStudent
                }
              >
                <X size={20} />
              </button>

            </div>


            <form
              className="students-form"
              onSubmit={
                createStudent
              }
            >

              {addError && (
                <div className="students-form-error">

                  <AlertTriangle
                    size={17}
                  />

                  <span>
                    {addError}
                  </span>

                </div>
              )}


              <div className="students-form-grid">

                <div className="students-form-field">

                  <label>
                    Full Name
                  </label>

                  <input
                    name="name"
                    value={
                      addForm.name
                    }
                    onChange={
                      handleAddFieldChange
                    }
                    placeholder="Student name"
                  />

                </div>


                <div className="students-form-field">

                  <label>
                    Registered Email
                  </label>

                  <input
                    name="email"
                    type="email"
                    value={
                      addForm.email
                    }
                    onChange={
                      handleAddFieldChange
                    }
                    placeholder="student@email.com"
                  />

                </div>


                <div className="students-form-field">

                  <label>
                    Mobile Number
                  </label>

                  <input
                    name="mobile"
                    value={
                      addForm.mobile
                    }
                    onChange={
                      handleAddFieldChange
                    }
                    maxLength={10}
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                  />

                </div>


                <div className="students-form-field">

                  <label>
                    Hostel
                  </label>

                  <select
                    name="hostelId"
                    value={
                      addForm.hostelId
                    }
                    onChange={
                      handleAddHostelChange
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


                <div className="students-form-field">

                  <label>
                    Block
                  </label>

                  <select
                    name="blockId"
                    value={
                      addForm.blockId
                    }
                    onChange={
                      handleAddFieldChange
                    }
                    disabled={
                      !addForm.hostelId
                    }
                  >
                    <option value="">
                      No specific Block
                    </option>

                    {addBlocks.map(
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


                <div className="students-form-field">

                  <label>
                    Assigned Mess
                  </label>

                  <select
                    name="messUnitId"
                    value={
                      addForm.messUnitId
                    }
                    onChange={
                      handleAddFieldChange
                    }
                    disabled={
                      !addForm.hostelId
                    }
                  >
                    <option value="">
                      Select Mess Unit
                    </option>

                    {addMessOptions.map(
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


                <div className="students-form-field">

                  <label>
                    Meal Category
                  </label>

                  <select
                    name="mealCategory"
                    value={
                      addForm.mealCategory
                    }
                    onChange={
                      handleAddFieldChange
                    }
                  >
                    <option value="veg">
                      Veg
                    </option>

                    <option value="non-veg">
                      Non-Veg
                    </option>
                  </select>

                </div>

              </div>


              <div className="students-default-password">

                <strong>
                  First Login Password
                </strong>

                <span>
                  The Student will receive the temporary password
                  {" "}
                  <b>
                    Mess@123
                  </b>
                  {" "}
                  and must change it before accessing the Student Dashboard.
                </span>

              </div>


              <div className="students-modal-actions">

                <button
                  type="button"
                  className="students-secondary-button"
                  onClick={
                    closeAddStudent
                  }
                  disabled={
                    addSaving
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="students-primary-button"
                  disabled={
                    addSaving
                  }
                >
                  {addSaving ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="students-spin"
                      />

                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />

                      Add Student
                    </>
                  )}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* =====================================================
          VIEW STUDENT
      ===================================================== */}

      {viewingStudent && (
        <div className="students-modal-backdrop">

          <div className="students-modal students-view-modal">

            <div className="students-modal-header">

              <div>
                <span className="students-eyebrow">
                  STUDENT DETAILS
                </span>

                <h2>
                  {viewingStudent.name}
                </h2>

                <p>
                  {viewingStudent.studentId}
                </p>
              </div>


              <button
                type="button"
                onClick={() =>
                  setViewingStudent(
                    null
                  )
                }
              >
                <X size={20} />
              </button>

            </div>


            <div className="students-view-content">

              <div>
                <span>
                  Email
                </span>

                <strong>
                  {viewingStudent.email}
                </strong>
              </div>


              <div>
                <span>
                  Mobile
                </span>

                <strong>
                  {viewingStudent.mobile ||
                    "—"}
                </strong>
              </div>


              <div>
                <span>
                  Hostel
                </span>

                <strong>
                  {viewingStudent.hostel?.name ||
                    "Unassigned"}
                </strong>
              </div>


              <div>
                <span>
                  Block
                </span>

                <strong>
                  {viewingStudent.block?.name ||
                    "—"}
                </strong>
              </div>


              <div>
                <span>
                  Mess Unit
                </span>

                <strong>
                  {viewingStudent.messUnit?.name ||
                    "Unassigned"}
                </strong>
              </div>


              <div>
                <span>
                  Meal Category
                </span>

                <strong>
                  {viewingStudent.mealCategory ===
                  "non-veg"
                    ? "Non-Veg"
                    : "Veg"}
                </strong>
              </div>


              <div>
                <span>
                  Status
                </span>

                <strong>
                  {viewingStudent.status ===
                  "active"
                    ? "Active"
                    : "Inactive"}
                </strong>
              </div>


              <div>
                <span>
                  Password Change
                </span>

                <strong>
                  {viewingStudent.mustChangePassword
                    ? "Required"
                    : "Completed"}
                </strong>
              </div>

            </div>


            <div className="students-modal-actions">

              <button
                type="button"
                className="students-secondary-button"
                onClick={() =>
                  setViewingStudent(
                    null
                  )
                }
              >
                Close
              </button>


              <button
                type="button"
                className="students-primary-button"
                onClick={() => {
                  const student =
                    viewingStudent;

                  setViewingStudent(
                    null
                  );

                  openAssignment(
                    student
                  );
                }}
              >
                Assign / Reassign
              </button>

            </div>

          </div>

        </div>
      )}


      {/* =====================================================
          ASSIGN / REASSIGN
      ===================================================== */}

      {assigningStudent && (
        <div className="students-modal-backdrop">

          <div className="students-modal">

            <div className="students-modal-header">

              <div>
                <h2>
                  Assign Student
                </h2>

                <p>
                  {assigningStudent.name}
                  {" • "}
                  {assigningStudent.studentId}
                </p>
              </div>


              <button
                type="button"
                onClick={() =>
                  setAssigningStudent(
                    null
                  )
                }
              >
                <X size={20} />
              </button>

            </div>


            <form
              className="students-form"
              onSubmit={
                saveAssignment
              }
            >

              {assignmentError && (
                <div className="students-form-error">

                  <AlertTriangle
                    size={17}
                  />

                  <span>
                    {assignmentError}
                  </span>

                </div>
              )}


              <div className="students-form-grid">

                <div className="students-form-field">

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


                <div className="students-form-field">

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
                            event.target
                              .value,
                        })
                      )
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


                <div className="students-form-field">

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
                            event.target
                              .value,
                        })
                      )
                    }
                  >
                    <option value="">
                      Select Mess Unit
                    </option>

                    {assignmentMessOptions.map(
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


                <div className="students-form-field">

                  <label>
                    Meal Category
                  </label>

                  <select
                    value={
                      assignmentForm.mealCategory
                    }
                    onChange={(event) =>
                      setAssignmentForm(
                        (current) => ({
                          ...current,

                          mealCategory:
                            event.target
                              .value,
                        })
                      )
                    }
                  >
                    <option value="veg">
                      Veg
                    </option>

                    <option value="non-veg">
                      Non-Veg
                    </option>
                  </select>

                </div>

              </div>


              <div className="students-modal-actions">

                <button
                  type="button"
                  className="students-secondary-button"
                  onClick={() =>
                    setAssigningStudent(
                      null
                    )
                  }
                  disabled={
                    assignmentSaving
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="students-primary-button"
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
          closeDeleteStudent
        }
        onConfirm={
          permanentlyDeleteStudent
        }
        recordType="student"
        recordName={
          deleteTarget?.name || ""
        }
        details={[
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
              "Student ID",
            value:
              deleteTarget?.studentId ||
              "—",
          },
        ]}
        relatedItems={[
          "Student profile and login account",
          "Hostel, block and mess-unit assignment",
          "Meal responses and attendance/skip responses",
          "Other records directly owned by this Student",
        ]}
        warningMessage="Deleting this Student permanently removes the Student account and directly owned Student data. The Hostel, Mess Unit, menus, staff and other students will not be deleted."
        deleteButtonText="Permanently Delete Student"
        error={deleteError}
        isDeleting={
          deleteSaving
        }
      />


      {/* =====================================================
          STATUS CONFIRMATION
      ===================================================== */}

      {statusTarget && (
        <div className="students-modal-backdrop">

          <div className="students-confirm-modal">

            <div
              className={`students-confirm-icon ${
                statusTarget.status ===
                "active"
                  ? "warning"
                  : "success"
              }`}
            >
              {statusTarget.status ===
              "active" ? (
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
              {statusTarget.status ===
              "active"
                ? "Deactivate Student?"
                : "Activate Student?"}
            </h2>


            <p>
              {statusTarget.status ===
              "active"
                ? "The Student will no longer be able to access the Student Dashboard until reactivated."
                : "The Student account will become active again."}
            </p>


            <strong>
              {statusTarget.name}
            </strong>


            <div className="students-modal-actions">

              <button
                type="button"
                className="students-secondary-button"
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
                  statusTarget.status ===
                  "active"
                    ? "students-danger-button"
                    : "students-primary-button"
                }
                onClick={
                  changeStudentStatus
                }
                disabled={
                  statusSaving
                }
              >
                {statusSaving
                  ? "Saving..."
                  : statusTarget.status ===
                    "active"
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


export default Students;