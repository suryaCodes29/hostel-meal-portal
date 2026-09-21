import {
  AlertCircle,
  Building2,
  Check,
  Edit3,
  Layers3,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useManager } from "../../context/ManagerContext";

import PermanentDeleteModal
  from "../../components/manager/PermanentDeleteModal";

import {
  buildPermanentDeleteBody,
  createPermanentDeleteRequestGuard,
  getPermanentDeleteErrorMessage,
} from "../../utils/permanentDelete";

import "./hostelDetails.css";


const createDefaultMessUnits = () => [
  {
    type: "north",
    name: "North Mess",
    selected: true,
    existingId: null,
    capacity: 300,
    supportsVeg: true,
    supportsNonVeg: true,
    status: "active",
  },
  {
    type: "south",
    name: "South Mess",
    selected: true,
    existingId: null,
    capacity: 300,
    supportsVeg: true,
    supportsNonVeg: true,
    status: "active",
  },
];


const createEmptyHostelForm = () => ({
  name: "",
  code: "",
  address: "",
  contactNumber: "",
  numberOfBlocks: 1,
  blockNames: [""],
  status: "active",
  messUnits: createDefaultMessUnits(),
});


function normalizeExistingMessUnits(
  hostel,
  selectMissing = false
) {
  const existingUnits =
    Array.isArray(hostel?.messUnits)
      ? hostel.messUnits
      : [];


  return [
    {
      type: "north",
      name: "North Mess",
    },
    {
      type: "south",
      name: "South Mess",
    },
  ].map((template) => {
    const existing =
      existingUnits.find(
        (item) =>
          String(
            item?.type ||
            item?.unitType ||
            ""
          ).toLowerCase() ===
          template.type
      );


    if (!existing) {
      return {
        ...template,
        selected: selectMissing,
        existingId: null,
        capacity: 300,
        supportsVeg: true,
        supportsNonVeg: true,
        status: "active",
      };
    }


    return {
      ...template,
      name:
        existing.name ||
        template.name,
      selected: true,
      existingId:
        existing.id,
      capacity:
        Number(
          existing.capacity || 300
        ),
      supportsVeg:
        existing.supportsVeg !== false,
      supportsNonVeg:
        existing.supportsNonVeg !== false,
      status:
        existing.status ||
        "active",
    };
  });
}


function HostelDetails() {
  const {
    apiFetch,
    loadFilterOptions,
  } = useManager();


  const [
    hostels,
    setHostels,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    refreshing,
    setRefreshing,
  ] = useState(false);


  const [
    pageError,
    setPageError,
  ] = useState("");


  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");


  const [
    searchText,
    setSearchText,
  ] = useState("");


  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");


  const [
    addModalOpen,
    setAddModalOpen,
  ] = useState(false);


  const [
    addForm,
    setAddForm,
  ] = useState(
    createEmptyHostelForm
  );


  const [
    addError,
    setAddError,
  ] = useState("");


  const [
    creatingHostel,
    setCreatingHostel,
  ] = useState(false);


  const [
    manageHostel,
    setManageHostel,
  ] = useState(null);


  const [
    manageMessUnits,
    setManageMessUnits,
  ] = useState([]);


  const [
    manageError,
    setManageError,
  ] = useState("");


  const [
    savingMessUnits,
    setSavingMessUnits,
  ] = useState(false);


  const [
    editHostel,
    setEditHostel,
  ] = useState(null);


  const [
    editForm,
    setEditForm,
  ] = useState(null);


  const [
    editError,
    setEditError,
  ] = useState("");


  const [
    savingEdit,
    setSavingEdit,
  ] = useState(false);


  const [
    statusChangingId,
    setStatusChangingId,
  ] = useState(null);


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
     REFRESH SHARED MANAGER DATA
  ========================================================= */

  const refreshSharedManagerData =
    useCallback(async () => {
      try {
        if (
          typeof loadFilterOptions ===
          "function"
        ) {
          await loadFilterOptions();
        }
      } catch (error) {
        console.error(
          "Unable to refresh Manager filters:",
          error
        );
      }


      window.dispatchEvent(
        new CustomEvent(
          "manager-data-updated",
          {
            detail: {
              source:
                "hostel-details",
            },
          }
        )
      );
    }, [loadFilterOptions]);


  /* =========================================================
     LOAD HOSTELS
  ========================================================= */

  const loadHostels =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!silent) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }


        setPageError("");


        try {
          const data =
            await apiFetch(
              "/api/manager/hostels"
            );


          setHostels(
            Array.isArray(
              data?.hostels
            )
              ? data.hostels
              : []
          );

        } catch (error) {
          console.error(
            "Hostel loading error:",
            error
          );


          setPageError(
            error?.message ||
            "Unable to load Hostel details."
          );

        } finally {
          setLoading(false);

          setRefreshing(false);
        }
      },
      [apiFetch]
    );


  useEffect(() => {
    loadHostels();
  }, [loadHostels]);


  /* =========================================================
     ESCAPE KEY
  ========================================================= */

  useEffect(() => {
    const handleEscape =
      (event) => {
        if (
          event.key !== "Escape"
        ) {
          return;
        }


        if (
          creatingHostel ||
          savingMessUnits ||
          savingEdit
        ) {
          return;
        }


        setAddModalOpen(false);

        setManageHostel(null);

        setEditHostel(null);
      };


    document.addEventListener(
      "keydown",
      handleEscape
    );


    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [
    creatingHostel,
    savingMessUnits,
    savingEdit,
  ]);


  /* =========================================================
     FILTER HOSTELS
  ========================================================= */

  const filteredHostels =
    useMemo(() => {
      const search =
        searchText
          .trim()
          .toLowerCase();


      return hostels.filter(
        (hostel) => {
          const matchesSearch =
            !search ||
            String(
              hostel.name || ""
            )
              .toLowerCase()
              .includes(search) ||
            String(
              hostel.code || ""
            )
              .toLowerCase()
              .includes(search);


          const matchesStatus =
            statusFilter ===
              "all" ||
            String(
              hostel.status ||
              ""
            ).toLowerCase() ===
              statusFilter;


          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      hostels,
      searchText,
      statusFilter,
    ]);


  /* =========================================================
     COMMON HELPERS
  ========================================================= */

  const getMessUnits = (
    hostel
  ) =>
    Array.isArray(
      hostel?.messUnits
    )
      ? hostel.messUnits
      : [];


  const resetMessages = () => {
    setSuccessMessage("");
    setPageError("");
    setAddError("");
    setManageError("");
    setEditError("");
    setDeleteError("");
  };


  const handleClearFilters = () => {
    setSearchText("");
    setStatusFilter("all");
  };


  /* =========================================================
     ADD HOSTEL FORM
  ========================================================= */

  const openAddHostel = () => {
    resetMessages();

    setAddForm(
      createEmptyHostelForm()
    );

    setAddModalOpen(true);
  };


  const closeAddHostel = () => {
    if (creatingHostel) {
      return;
    }

    setAddModalOpen(false);

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
          [name]:
            value,
        })
      );
    };


  const handleBlockCountChange =
    (event) => {
      let count =
        Number(
          event.target.value
        );


      if (
        Number.isNaN(count) ||
        count < 1
      ) {
        count = 1;
      }


      if (count > 20) {
        count = 20;
      }


      setAddForm(
        (current) => {
          const nextBlocks = [
            ...current.blockNames,
          ];


          while (
            nextBlocks.length <
            count
          ) {
            nextBlocks.push("");
          }


          return {
            ...current,

            numberOfBlocks:
              count,

            blockNames:
              nextBlocks.slice(
                0,
                count
              ),
          };
        }
      );
    };


  const handleBlockNameChange =
    (
      index,
      value
    ) => {
      setAddForm(
        (current) => {
          const nextBlocks = [
            ...current.blockNames,
          ];


          nextBlocks[index] =
            value;


          return {
            ...current,
            blockNames:
              nextBlocks,
          };
        }
      );
    };


  const updateAddMessUnit =
    (
      type,
      field,
      value
    ) => {
      setAddForm(
        (current) => ({
          ...current,

          messUnits:
            current.messUnits.map(
              (item) =>
                item.type === type
                  ? {
                      ...item,
                      [field]:
                        value,
                    }
                  : item
            ),
        })
      );
    };


  const createHostel =
    async (event) => {
      event.preventDefault();

      setAddError("");

      setSuccessMessage("");


      const name =
        addForm.name.trim();

      const code =
        addForm.code
          .trim()
          .toUpperCase();

      const contactNumber =
        addForm.contactNumber
          .trim();


      const blocks =
        addForm.blockNames
          .map(
            (block) =>
              block.trim()
          )
          .filter(Boolean);


      const selectedUnits =
        addForm.messUnits.filter(
          (unit) =>
            unit.selected
        );


      if (!name) {
        setAddError(
          "Hostel name is required."
        );

        return;
      }


      if (!code) {
        setAddError(
          "Hostel code is required."
        );

        return;
      }


      if (
        contactNumber &&
        !/^[6-9]\d{9}$/.test(
          contactNumber
        )
      ) {
        setAddError(
          "Please enter a valid 10-digit contact number."
        );

        return;
      }


      if (
        blocks.length === 0
      ) {
        setAddError(
          "Please enter at least one Hostel block."
        );

        return;
      }


      const uniqueBlocks =
        new Set(
          blocks.map(
            (block) =>
              block.toLowerCase()
          )
        );


      if (
        uniqueBlocks.size !==
        blocks.length
      ) {
        setAddError(
          "Block names must not be duplicated."
        );

        return;
      }


      if (
        selectedUnits.length === 0
      ) {
        setAddError(
          "Please select at least one Mess Unit."
        );

        return;
      }


      for (
        const unit
        of selectedUnits
      ) {
        if (
          Number(
            unit.capacity
          ) <= 0
        ) {
          setAddError(
            `${unit.name} capacity must be greater than 0.`
          );

          return;
        }


        if (
          !unit.supportsVeg &&
          !unit.supportsNonVeg
        ) {
          setAddError(
            `${unit.name} must support Veg, Non-Veg, or both.`
          );

          return;
        }
      }


      setCreatingHostel(true);


      try {
        const response =
          await apiFetch(
            "/api/manager/hostels",
            {
              method: "POST",

              body:
                JSON.stringify({
                  name,
                  code,

                  address:
                    addForm.address
                      .trim(),

                  contactNumber,

                  blockNames:
                    blocks,

                  status:
                    addForm.status,

                  messUnits:
                    selectedUnits.map(
                      (unit) => ({
                        name:
                          unit.name,

                        type:
                          unit.type,

                        capacity:
                          Number(
                            unit.capacity
                          ),

                        supportsVeg:
                          Boolean(
                            unit.supportsVeg
                          ),

                        supportsNonVeg:
                          Boolean(
                            unit.supportsNonVeg
                          ),

                        status:
                          "active",
                      })
                    ),
                }),
            }
          );


        setAddModalOpen(false);

        setAddForm(
          createEmptyHostelForm()
        );


        setSuccessMessage(
          response?.message ||
          "Hostel and selected Mess Units created successfully."
        );


        await loadHostels({
          silent: true,
        });


        await refreshSharedManagerData();

      } catch (error) {
        console.error(
          "Hostel creation error:",
          error
        );


        setAddError(
          error?.message ||
          "Unable to create Hostel."
        );

      } finally {
        setCreatingHostel(false);
      }
    };


  /* =========================================================
     MANAGE MESS UNITS
  ========================================================= */

  const openManageMessUnits =
    (hostel) => {
      resetMessages();

      setManageHostel(
        hostel
      );


      setManageMessUnits(
        normalizeExistingMessUnits(
          hostel,
          false
        )
      );
    };


  const closeManageMessUnits =
    () => {
      if (savingMessUnits) {
        return;
      }


      setManageHostel(null);

      setManageMessUnits([]);

      setManageError("");
    };


  const updateManageMessUnit =
    (
      type,
      field,
      value
    ) => {
      setManageMessUnits(
        (current) =>
          current.map(
            (item) =>
              item.type === type
                ? {
                    ...item,
                    [field]:
                      value,
                  }
                : item
          )
      );
    };


  const saveManagedMessUnits =
    async (event) => {
      event.preventDefault();

      setManageError("");


      if (!manageHostel) {
        return;
      }


      const missingSelected =
        manageMessUnits.filter(
          (unit) =>
            unit.selected &&
            !unit.existingId
        );


      if (
        missingSelected.length ===
        0
      ) {
        setManageError(
          "Select at least one missing Mess Unit to add."
        );

        return;
      }


      for (
        const unit
        of missingSelected
      ) {
        if (
          Number(
            unit.capacity
          ) <= 0
        ) {
          setManageError(
            `${unit.name} capacity must be greater than 0.`
          );

          return;
        }


        if (
          !unit.supportsVeg &&
          !unit.supportsNonVeg
        ) {
          setManageError(
            `${unit.name} must support Veg, Non-Veg, or both.`
          );

          return;
        }
      }


      setSavingMessUnits(true);


      try {
        const response =
          await apiFetch(
            `/api/manager/hostels/${manageHostel.id}/mess-units`,
            {
              method: "POST",

              body:
                JSON.stringify({
                  messUnits:
                    missingSelected.map(
                      (unit) => ({
                        name:
                          unit.name,

                        type:
                          unit.type,

                        capacity:
                          Number(
                            unit.capacity
                          ),

                        supportsVeg:
                          Boolean(
                            unit.supportsVeg
                          ),

                        supportsNonVeg:
                          Boolean(
                            unit.supportsNonVeg
                          ),

                        status:
                          "active",
                      })
                    ),
                }),
            }
          );


        setManageHostel(null);

        setManageMessUnits([]);


        setSuccessMessage(
          response?.message ||
          "Selected Mess Units added successfully."
        );


        await loadHostels({
          silent: true,
        });


        await refreshSharedManagerData();

      } catch (error) {
        console.error(
          "Manage Mess Units error:",
          error
        );


        setManageError(
          error?.message ||
          "Unable to add Mess Units."
        );

      } finally {
        setSavingMessUnits(false);
      }
    };


  /* =========================================================
     EDIT HOSTEL
  ========================================================= */

  const openEditHostel =
    (hostel) => {
      resetMessages();

      setEditHostel(
        hostel
      );


      setEditForm({
        name:
          hostel.name || "",

        code:
          hostel.code || "",

        address:
          hostel.address || "",

        contactNumber:
          hostel.contactNumber || "",

        status:
          hostel.status ||
          "active",

        messUnits:
          normalizeExistingMessUnits(
            hostel,
            false
          ),
      });
    };


  const closeEditHostel =
    () => {
      if (savingEdit) {
        return;
      }


      setEditHostel(null);

      setEditForm(null);

      setEditError("");
    };


  const handleEditFieldChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;


      setEditForm(
        (current) => ({
          ...current,
          [name]:
            value,
        })
      );
    };


  const updateEditMessUnit =
    (
      type,
      field,
      value
    ) => {
      setEditForm(
        (current) => ({
          ...current,

          messUnits:
            current.messUnits.map(
              (item) =>
                item.type === type
                  ? {
                      ...item,
                      [field]:
                        value,
                    }
                  : item
            ),
        })
      );
    };


  const toggleEditMessSelection =
    (unit) => {
      if (!editForm) {
        return;
      }


      if (
        unit.existingId &&
        unit.selected
      ) {
        const confirmed =
          window.confirm(
            `${unit.name} already exists. Removing it will not delete its data. It will be marked Inactive instead. Continue?`
          );


        if (!confirmed) {
          return;
        }


        setEditForm(
          (current) => ({
            ...current,

            messUnits:
              current.messUnits.map(
                (item) =>
                  item.type ===
                  unit.type
                    ? {
                        ...item,
                        selected:
                          false,
                        status:
                          "inactive",
                      }
                    : item
              ),
          })
        );


        return;
      }


      setEditForm(
        (current) => ({
          ...current,

          messUnits:
            current.messUnits.map(
              (item) =>
                item.type ===
                unit.type
                  ? {
                      ...item,
                      selected:
                        true,
                      status:
                        "active",
                    }
                  : item
            ),
        })
      );
    };


  const saveHostelEdit =
    async (event) => {
      event.preventDefault();

      setEditError("");


      if (
        !editHostel ||
        !editForm
      ) {
        return;
      }


      const name =
        editForm.name.trim();

      const code =
        editForm.code
          .trim()
          .toUpperCase();

      const contactNumber =
        editForm.contactNumber
          .trim();


      if (!name || !code) {
        setEditError(
          "Hostel name and code are required."
        );

        return;
      }


      if (
        contactNumber &&
        !/^[6-9]\d{9}$/.test(
          contactNumber
        )
      ) {
        setEditError(
          "Please enter a valid 10-digit contact number."
        );

        return;
      }


      for (
        const unit
        of editForm.messUnits
      ) {
        if (
          unit.selected &&
          Number(
            unit.capacity
          ) <= 0
        ) {
          setEditError(
            `${unit.name} capacity must be greater than 0.`
          );

          return;
        }


        if (
          unit.selected &&
          !unit.supportsVeg &&
          !unit.supportsNonVeg
        ) {
          setEditError(
            `${unit.name} must support Veg, Non-Veg, or both.`
          );

          return;
        }
      }


      setSavingEdit(true);


      try {
        await apiFetch(
          `/api/manager/hostels/${editHostel.id}`,
          {
            method: "PUT",

            body:
              JSON.stringify({
                name,
                code,

                address:
                  editForm.address
                    .trim(),

                contactNumber,

                status:
                  editForm.status,
              }),
          }
        );


        for (
          const unit
          of editForm.messUnits
        ) {
          if (
            unit.existingId
          ) {
            await apiFetch(
              `/api/manager/mess-units/${unit.existingId}`,
              {
                method: "PUT",

                body:
                  JSON.stringify({
                    name:
                      unit.name,

                    type:
                      unit.type,

                    capacity:
                      Number(
                        unit.capacity
                      ),

                    supportsVeg:
                      Boolean(
                        unit.supportsVeg
                      ),

                    supportsNonVeg:
                      Boolean(
                        unit.supportsNonVeg
                      ),

                    status:
                      unit.selected
                        ? unit.status
                        : "inactive",
                  }),
              }
            );
          }
        }


        const newUnits =
          editForm.messUnits.filter(
            (unit) =>
              unit.selected &&
              !unit.existingId
          );


        if (
          newUnits.length > 0
        ) {
          await apiFetch(
            `/api/manager/hostels/${editHostel.id}/mess-units`,
            {
              method: "POST",

              body:
                JSON.stringify({
                  messUnits:
                    newUnits.map(
                      (unit) => ({
                        name:
                          unit.name,

                        type:
                          unit.type,

                        capacity:
                          Number(
                            unit.capacity
                          ),

                        supportsVeg:
                          Boolean(
                            unit.supportsVeg
                          ),

                        supportsNonVeg:
                          Boolean(
                            unit.supportsNonVeg
                          ),

                        status:
                          unit.status,
                      })
                    ),
                }),
            }
          );
        }


        setEditHostel(null);

        setEditForm(null);


        setSuccessMessage(
          "Hostel and Mess Unit settings updated successfully."
        );


        await loadHostels({
          silent: true,
        });


        await refreshSharedManagerData();

      } catch (error) {
        console.error(
          "Hostel update error:",
          error
        );


        setEditError(
          error?.message ||
          "Unable to update Hostel."
        );

      } finally {
        setSavingEdit(false);
      }
    };


  /* =========================================================
     ACTIVATE / DEACTIVATE HOSTEL
  ========================================================= */

  const changeHostelStatus =
    async (hostel) => {
      const isActive =
        String(
          hostel.status
        ).toLowerCase() ===
        "active";


      const nextStatus =
        isActive
          ? "inactive"
          : "active";


      const confirmed =
        window.confirm(
          isActive
            ? `Deactivate ${hostel.name}? Existing records will be preserved.`
            : `Activate ${hostel.name}?`
        );


      if (!confirmed) {
        return;
      }


      setStatusChangingId(
        hostel.id
      );


      setSuccessMessage("");

      setPageError("");


      try {
        await apiFetch(
          `/api/manager/hostels/${hostel.id}`,
          {
            method: "PUT",

            body:
              JSON.stringify({
                name:
                  hostel.name,

                code:
                  hostel.code,

                address:
                  hostel.address || "",

                contactNumber:
                  hostel.contactNumber ||
                  "",

                status:
                  nextStatus,
              }),
          }
        );


        const units =
          getMessUnits(
            hostel
          );


        for (
          const unit
          of units
        ) {
          await apiFetch(
            `/api/manager/mess-units/${unit.id}`,
            {
              method: "PUT",

              body:
                JSON.stringify({
                  name:
                    unit.name,

                  type:
                    unit.type ||
                    unit.unitType,

                  capacity:
                    Number(
                      unit.capacity ||
                      300
                    ),

                  supportsVeg:
                    unit.supportsVeg !==
                    false,

                  supportsNonVeg:
                    unit.supportsNonVeg !==
                    false,

                  status:
                    nextStatus,
                }),
            }
          );
        }


        setSuccessMessage(
          nextStatus === "active"
            ? "Hostel activated successfully."
            : "Hostel deactivated successfully."
        );


        await loadHostels({
          silent: true,
        });


        await refreshSharedManagerData();

      } catch (error) {
        console.error(
          "Hostel status error:",
          error
        );


        setPageError(
          error?.message ||
          "Unable to change Hostel status."
        );

      } finally {
        setStatusChangingId(
          null
        );
      }
    };


  /* =========================================================
     PERMANENT DELETE HOSTEL
  ========================================================= */

  const openDeleteHostel =
    (hostel) => {
      if (!hostel) {
        return;
      }


      resetMessages();

      setDeleteTarget(
        hostel
      );
    };


  const closeDeleteHostel =
    () => {
      if (deleteSaving) {
        return;
      }


      setDeleteError("");

      setDeleteTarget(null);
    };


  const permanentlyDeleteHostel =
    async (confirmation) => {
      if (!deleteTarget) {
        return;
      }


      const requestGuard =
        deleteRequestGuardRef.current;


      if (!requestGuard.tryStart()) {
        return;
      }


      const hostelToDelete =
        deleteTarget;


      setDeleteSaving(true);

      setDeleteError("");


      try {
        const response =
          await apiFetch(
            `/api/manager/hostels/${hostelToDelete.id}`,
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


        setHostels(
          (currentHostels) =>
            currentHostels.filter(
              (hostel) =>
                hostel.id !==
                hostelToDelete.id
            )
        );


        setDeleteTarget(null);


        setSuccessMessage(
          response?.message ||
          `${hostelToDelete.name} and all related data were deleted permanently.`
        );


        await loadHostels({
          silent: true,
        });


        await refreshSharedManagerData();

      } catch (error) {
        console.error(
          "Permanent Hostel delete error:",
          error
        );


        setDeleteError(
          getPermanentDeleteErrorMessage(
            error,
            "Unable to permanently delete this Hostel."
          )
        );

      } finally {
        requestGuard.finish();

        setDeleteSaving(false);
      }
    };


  /* =========================================================
     MESS UNIT CARD
  ========================================================= */

  const renderMessUnitFields = (
    unit,
    updateFunction,
    {
      allowSelection = true,
      existingSelectionLocked = false,
    } = {}
  ) => {
    const isLockedExisting =
      existingSelectionLocked &&
      Boolean(
        unit.existingId
      );


    return (
      <div
        key={unit.type}
        className={`hostel-details-mess-card ${
          unit.selected
            ? "selected"
            : ""
        }`}
      >
        <div className="hostel-details-mess-card-header">

          <label className="hostel-details-mess-select">

            <input
              type="checkbox"
              checked={
                Boolean(
                  unit.selected
                )
              }
              disabled={
                isLockedExisting
              }
              onChange={(event) => {
                if (
                  !allowSelection
                ) {
                  return;
                }


                updateFunction(
                  unit.type,
                  "selected",
                  event.target.checked
                );
              }}
            />

            <span className="hostel-details-checkbox-box">
              <Check size={14} />
            </span>


            <span className="hostel-details-mess-name">
              <UtensilsCrossed
                size={18}
              />

              {unit.name}
            </span>

          </label>


          {unit.existingId && (
            <span className="hostel-details-existing-badge">
              Existing
            </span>
          )}

        </div>


        {unit.selected && (
          <div className="hostel-details-mess-fields">

            <label>
              <span>
                Capacity
              </span>

              <input
                type="number"
                min="1"
                value={
                  unit.capacity
                }
                onChange={(event) => {
                  updateFunction(
                    unit.type,
                    "capacity",
                    event.target.value
                  );
                }}
              />
            </label>


            <div className="hostel-details-support-options">

              <label>
                <input
                  type="checkbox"
                  checked={
                    Boolean(
                      unit.supportsVeg
                    )
                  }
                  onChange={(event) => {
                    updateFunction(
                      unit.type,
                      "supportsVeg",
                      event.target.checked
                    );
                  }}
                />

                Supports Veg
              </label>


              <label>
                <input
                  type="checkbox"
                  checked={
                    Boolean(
                      unit.supportsNonVeg
                    )
                  }
                  onChange={(event) => {
                    updateFunction(
                      unit.type,
                      "supportsNonVeg",
                      event.target.checked
                    );
                  }}
                />

                Supports Non-Veg
              </label>

            </div>

          </div>
        )}

      </div>
    );
  };


  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <div className="hostel-details-page">

      {/* PAGE HEADER */}

      <div className="hostel-details-page-header">

        <div>
          <span className="hostel-details-eyebrow">
            HOSTEL MANAGEMENT
          </span>

          <h1>
            Hostel Details
          </h1>

          <p>
            Manage hostels and their mess units
          </p>
        </div>


        <button
          type="button"
          className="hostel-details-add-button"
          onClick={
            openAddHostel
          }
        >
          <Plus size={18} />

          Add Hostel
        </button>

      </div>


      {/* MESSAGES */}

      {successMessage && (
        <div className="hostel-details-message success">

          <Check size={18} />

          <span>
            {successMessage}
          </span>


          <button
            type="button"
            onClick={() =>
              setSuccessMessage("")
            }
            aria-label="Close success message"
          >
            <X size={16} />
          </button>

        </div>
      )}


      {pageError && (
        <div className="hostel-details-message error">

          <AlertCircle size={18} />

          <span>
            {pageError}
          </span>


          <button
            type="button"
            onClick={() =>
              setPageError("")
            }
            aria-label="Close error message"
          >
            <X size={16} />
          </button>

        </div>
      )}


      {/* FILTERS */}

      <section className="hostel-details-filter-card">

        <div className="hostel-details-search-field">

          <Search size={18} />

          <input
            type="text"
            value={
              searchText
            }
            placeholder="Search by Hostel name or code"
            onChange={(event) =>
              setSearchText(
                event.target.value
              )
            }
          />

        </div>


        <select
          value={
            statusFilter
          }
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
          aria-label="Filter Hostel status"
        >
          <option value="all">
            All Status
          </option>

          <option value="active">
            Active
          </option>

          <option value="inactive">
            Inactive
          </option>
        </select>


        <button
          type="button"
          className="hostel-details-clear-button"
          onClick={
            handleClearFilters
          }
        >
          <RotateCcw size={16} />

          Clear Filters
        </button>


        <button
          type="button"
          className="hostel-details-refresh-button"
          onClick={() =>
            loadHostels({
              silent: true,
            })
          }
          disabled={
            refreshing
          }
          aria-label="Refresh Hostels"
          title="Refresh Hostels"
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? "spinning"
                : ""
            }
          />
        </button>

      </section>


      {/* CONTENT */}

      {loading ? (

        <div className="hostel-details-state-card">

          <Loader2
            size={28}
            className="spinning"
          />

          <strong>
            Loading Hostel details...
          </strong>

        </div>

      ) : pageError &&
        hostels.length === 0 ? (

        <div className="hostel-details-state-card">

          <AlertCircle
            size={28}
          />

          <strong>
            Unable to load Hostels
          </strong>

          <p>
            {pageError}
          </p>

          <button
            type="button"
            onClick={() =>
              loadHostels()
            }
          >
            Retry
          </button>

        </div>

      ) : filteredHostels.length ===
        0 ? (

        <div className="hostel-details-state-card">

          <Building2
            size={32}
          />

          <strong>
            No Hostels found
          </strong>

          <p>
            Try changing the search or status filter.
          </p>

        </div>

      ) : (

        <div className="hostel-details-grid">

          {filteredHostels.map(
            (hostel) => {
              const messUnits =
                getMessUnits(
                  hostel
                );


              const hasMessUnits =
                messUnits.length >
                0;


              return (
                <article
                  key={
                    hostel.id
                  }
                  className="hostel-details-card"
                >

                  <div className="hostel-details-card-header">

                    <div className="hostel-details-card-title">

                      <div className="hostel-details-building-icon">
                        <Building2
                          size={21}
                        />
                      </div>


                      <div>
                        <span className="hostel-details-code">
                          {hostel.code}
                        </span>

                        <h2>
                          {hostel.name}
                        </h2>
                      </div>

                    </div>


                    <span
                      className={`hostel-details-status ${
                        hostel.status ===
                        "active"
                          ? "active"
                          : "inactive"
                      }`}
                    >
                      {hostel.status ===
                      "active"
                        ? "Active"
                        : "Inactive"}
                    </span>

                  </div>


                  <div className="hostel-details-card-info">

                    <div>
                      <MapPin
                        size={16}
                      />

                      <span>
                        {hostel.address ||
                          "No address provided"}
                      </span>
                    </div>


                    <div>
                      <Phone
                        size={16}
                      />

                      <span>
                        {hostel.contactNumber ||
                          "No contact number"}
                      </span>
                    </div>


                    <div>
                      <Layers3
                        size={16}
                      />

                      <span>
                        {hostel.blocks
                          ?.length || 0}
                        {" "}
                        Block(s)
                      </span>
                    </div>

                  </div>


                  <div className="hostel-details-blocks">

                    <span className="hostel-details-section-label">
                      Blocks
                    </span>


                    <div className="hostel-details-chip-row">

                      {Array.isArray(
                        hostel.blocks
                      ) &&
                      hostel.blocks
                        .length >
                        0 ? (
                        hostel.blocks.map(
                          (block) => (
                            <span
                              key={
                                block.id
                              }
                              className="hostel-details-chip"
                            >
                              {block.name}
                            </span>
                          )
                        )
                      ) : (
                        <span className="hostel-details-muted">
                          No Blocks
                        </span>
                      )}

                    </div>

                  </div>


                  <div className="hostel-details-mess-section">

                    <div className="hostel-details-mess-section-title">

                      <span className="hostel-details-section-label">
                        Mess Units
                      </span>


                      <span className="hostel-details-count">
                        {
                          messUnits.length
                        }
                      </span>

                    </div>


                    {hasMessUnits ? (

                      <div className="hostel-details-unit-list">

                        {messUnits.map(
                          (unit) => (
                            <div
                              key={
                                unit.id
                              }
                              className="hostel-details-unit-row"
                            >

                              <div>
                                <UtensilsCrossed
                                  size={16}
                                />

                                <span>
                                  {unit.name}
                                </span>
                              </div>


                              <div className="hostel-details-unit-meta">

                                <span>
                                  Capacity{" "}
                                  {unit.capacity ||
                                    0}
                                </span>


                                {unit.supportsVeg && (
                                  <span className="veg">
                                    Veg
                                  </span>
                                )}


                                {unit.supportsNonVeg && (
                                  <span className="non-veg">
                                    Non-Veg
                                  </span>
                                )}


                                <span
                                  className={`unit-status ${
                                    unit.status ===
                                    "active"
                                      ? "active"
                                      : "inactive"
                                  }`}
                                >
                                  {unit.status}
                                </span>

                              </div>

                            </div>
                          )
                        )}

                      </div>

                    ) : (

                      <div className="hostel-details-no-mess">

                        <AlertCircle
                          size={20}
                        />

                        <div>
                          <strong>
                            No Mess Units assigned
                          </strong>

                          <span>
                            Add North Mess, South Mess, or both.
                          </span>
                        </div>


                        <button
                          type="button"
                          onClick={() =>
                            openManageMessUnits(
                              hostel
                            )
                          }
                        >
                          <Plus
                            size={15}
                          />

                          Add Mess Units
                        </button>

                      </div>

                    )}


                    {hasMessUnits &&
                      messUnits.length <
                        2 && (
                        <button
                          type="button"
                          className="hostel-details-add-missing-button"
                          onClick={() =>
                            openManageMessUnits(
                              hostel
                            )
                          }
                        >
                          <Plus
                            size={15}
                          />

                          Add Missing Mess Unit
                        </button>
                      )}

                  </div>


                  <div className="hostel-details-card-actions">

                    <button
                      type="button"
                      className="hostel-details-edit-button"
                      onClick={() =>
                        openEditHostel(
                          hostel
                        )
                      }
                    >
                      <Edit3 size={16} />

                      Edit
                    </button>


                    <button
                      type="button"
                      className={
                        hostel.status ===
                        "active"
                          ? "hostel-details-deactivate-button"
                          : "hostel-details-activate-button"
                      }
                      disabled={
                        statusChangingId ===
                        hostel.id
                      }
                      onClick={() =>
                        changeHostelStatus(
                          hostel
                        )
                      }
                    >

                      {statusChangingId ===
                      hostel.id ? (
                        <Loader2
                          size={16}
                          className="spinning"
                        />
                      ) : (
                        <Power
                          size={16}
                        />
                      )}

                      {hostel.status ===
                      "active"
                        ? "Deactivate"
                        : "Activate"}

                    </button>


                    <button
                      type="button"
                      className="manager-delete-action"
                      onClick={() =>
                        openDeleteHostel(
                          hostel
                        )
                      }
                      disabled={
                        deleteSaving &&
                        deleteTarget?.id ===
                          hostel.id
                      }
                      title={`Delete ${hostel.name} permanently`}
                      aria-label={`Delete ${hostel.name} permanently`}
                    >
                      <Trash2 size={16} />

                      Delete
                    </button>

                  </div>

                </article>
              );
            }
          )}

        </div>
      )}


      {/* =====================================================
          ADD HOSTEL MODAL
      ===================================================== */}

      {addModalOpen && (
        <div
          className="hostel-details-modal-overlay"
          role="presentation"
        >

          <div
            className="hostel-details-modal hostel-details-modal-large"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-hostel-title"
          >

            <div className="hostel-details-modal-header">

              <div>
                <h2 id="add-hostel-title">
                  Add Hostel
                </h2>

                <p>
                  Create a Hostel and assign its Mess Units.
                </p>
              </div>


              <button
                type="button"
                className="hostel-details-modal-close"
                onClick={
                  closeAddHostel
                }
                aria-label="Close Add Hostel"
              >
                <X size={20} />
              </button>

            </div>


            <form
              onSubmit={
                createHostel
              }
            >

              <div className="hostel-details-modal-body">

                {addError && (
                  <div className="hostel-details-form-error">
                    <AlertCircle
                      size={17}
                    />

                    {addError}
                  </div>
                )}


                <div className="hostel-details-form-grid">

                  <label>
                    <span>
                      Hostel Name *
                    </span>

                    <input
                      type="text"
                      name="name"
                      value={
                        addForm.name
                      }
                      onChange={
                        handleAddFieldChange
                      }
                      placeholder="Example: Chandu Hostel"
                    />
                  </label>


                  <label>
                    <span>
                      Hostel Code *
                    </span>

                    <input
                      type="text"
                      name="code"
                      value={
                        addForm.code
                      }
                      onChange={
                        handleAddFieldChange
                      }
                      placeholder="Example: CHA"
                    />
                  </label>


                  <label className="full-width">
                    <span>
                      Address
                    </span>

                    <input
                      type="text"
                      name="address"
                      value={
                        addForm.address
                      }
                      onChange={
                        handleAddFieldChange
                      }
                      placeholder="Hostel address"
                    />
                  </label>


                  <label>
                    <span>
                      Contact Number
                    </span>

                    <input
                      type="tel"
                      name="contactNumber"
                      maxLength={10}
                      value={
                        addForm.contactNumber
                      }
                      onChange={
                        handleAddFieldChange
                      }
                      placeholder="9876543210"
                    />
                  </label>


                  <label>
                    <span>
                      Status
                    </span>

                    <select
                      name="status"
                      value={
                        addForm.status
                      }
                      onChange={
                        handleAddFieldChange
                      }
                    >
                      <option value="active">
                        Active
                      </option>

                      <option value="inactive">
                        Inactive
                      </option>
                    </select>
                  </label>


                  <label>
                    <span>
                      Number of Blocks *
                    </span>

                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={
                        addForm.numberOfBlocks
                      }
                      onChange={
                        handleBlockCountChange
                      }
                    />
                  </label>

                </div>


                <div className="hostel-details-form-section">

                  <h3>
                    Block Names
                  </h3>


                  <div className="hostel-details-block-input-grid">

                    {addForm.blockNames.map(
                      (
                        block,
                        index
                      ) => (
                        <label
                          key={
                            index
                          }
                        >
                          <span>
                            Block{" "}
                            {index + 1}
                          </span>

                          <input
                            type="text"
                            value={
                              block
                            }
                            onChange={(event) =>
                              handleBlockNameChange(
                                index,
                                event.target.value
                              )
                            }
                            placeholder={`Block ${
                              index + 1
                            } name`}
                          />
                        </label>
                      )
                    )}

                  </div>

                </div>


                <div className="hostel-details-form-section">

                  <div className="hostel-details-section-heading">

                    <div>
                      <h3>
                        Select Mess Units *
                      </h3>

                      <p>
                        At least one Mess Unit must be selected.
                      </p>
                    </div>

                  </div>


                  <div className="hostel-details-mess-selection-grid">

                    {addForm.messUnits.map(
                      (unit) =>
                        renderMessUnitFields(
                          unit,
                          updateAddMessUnit
                        )
                    )}

                  </div>

                </div>

              </div>


              <div className="hostel-details-modal-footer">

                <button
                  type="button"
                  className="hostel-details-secondary-button"
                  onClick={
                    closeAddHostel
                  }
                  disabled={
                    creatingHostel
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="hostel-details-primary-button"
                  disabled={
                    creatingHostel
                  }
                >

                  {creatingHostel ? (
                    <Loader2
                      size={17}
                      className="spinning"
                    />
                  ) : (
                    <Save
                      size={17}
                    />
                  )}

                  {creatingHostel
                    ? "Creating..."
                    : "Create Hostel"}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* =====================================================
          MANAGE MESS UNITS MODAL
      ===================================================== */}

      {manageHostel && (
        <div
          className="hostel-details-modal-overlay"
          role="presentation"
        >

          <div
            className="hostel-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-mess-title"
          >

            <div className="hostel-details-modal-header">

              <div>
                <h2 id="manage-mess-title">
                  Manage Mess Units
                </h2>

                <p>
                  {manageHostel.name}
                </p>
              </div>


              <button
                type="button"
                className="hostel-details-modal-close"
                onClick={
                  closeManageMessUnits
                }
                aria-label="Close Manage Mess Units"
              >
                <X size={20} />
              </button>

            </div>


            <form
              onSubmit={
                saveManagedMessUnits
              }
            >

              <div className="hostel-details-modal-body">

                {manageError && (
                  <div className="hostel-details-form-error">
                    <AlertCircle
                      size={17}
                    />

                    {manageError}
                  </div>
                )}


                <p className="hostel-details-modal-note">
                  Existing Mess Units are already assigned and cannot be created again.
                </p>


                <div className="hostel-details-mess-selection-grid single-column">

                  {manageMessUnits.map(
                    (unit) =>
                      renderMessUnitFields(
                        unit,
                        updateManageMessUnit,
                        {
                          existingSelectionLocked:
                            true,
                        }
                      )
                  )}

                </div>

              </div>


              <div className="hostel-details-modal-footer">

                <button
                  type="button"
                  className="hostel-details-secondary-button"
                  onClick={
                    closeManageMessUnits
                  }
                  disabled={
                    savingMessUnits
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="hostel-details-primary-button"
                  disabled={
                    savingMessUnits
                  }
                >

                  {savingMessUnits ? (
                    <Loader2
                      size={17}
                      className="spinning"
                    />
                  ) : (
                    <Save
                      size={17}
                    />
                  )}

                  {savingMessUnits
                    ? "Saving..."
                    : "Save Mess Units"}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* =====================================================
          EDIT HOSTEL MODAL
      ===================================================== */}

      {editHostel &&
        editForm && (
          <div
            className="hostel-details-modal-overlay"
            role="presentation"
          >

            <div
              className="hostel-details-modal hostel-details-modal-large"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-hostel-title"
            >

              <div className="hostel-details-modal-header">

                <div>
                  <h2 id="edit-hostel-title">
                    Edit Hostel
                  </h2>

                  <p>
                    Update Hostel information and Manage Mess Units.
                  </p>
                </div>


                <button
                  type="button"
                  className="hostel-details-modal-close"
                  onClick={
                    closeEditHostel
                  }
                  aria-label="Close Edit Hostel"
                >
                  <X size={20} />
                </button>

              </div>


              <form
                onSubmit={
                  saveHostelEdit
                }
              >

                <div className="hostel-details-modal-body">

                  {editError && (
                    <div className="hostel-details-form-error">
                      <AlertCircle
                        size={17}
                      />

                      {editError}
                    </div>
                  )}


                  <div className="hostel-details-form-grid">

                    <label>
                      <span>
                        Hostel Name *
                      </span>

                      <input
                        type="text"
                        name="name"
                        value={
                          editForm.name
                        }
                        onChange={
                          handleEditFieldChange
                        }
                      />
                    </label>


                    <label>
                      <span>
                        Hostel Code *
                      </span>

                      <input
                        type="text"
                        name="code"
                        value={
                          editForm.code
                        }
                        onChange={
                          handleEditFieldChange
                        }
                      />
                    </label>


                    <label className="full-width">
                      <span>
                        Address
                      </span>

                      <input
                        type="text"
                        name="address"
                        value={
                          editForm.address
                        }
                        onChange={
                          handleEditFieldChange
                        }
                      />
                    </label>


                    <label>
                      <span>
                        Contact Number
                      </span>

                      <input
                        type="tel"
                        name="contactNumber"
                        maxLength={10}
                        value={
                          editForm.contactNumber
                        }
                        onChange={
                          handleEditFieldChange
                        }
                      />
                    </label>


                    <label>
                      <span>
                        Hostel Status
                      </span>

                      <select
                        name="status"
                        value={
                          editForm.status
                        }
                        onChange={
                          handleEditFieldChange
                        }
                      >
                        <option value="active">
                          Active
                        </option>

                        <option value="inactive">
                          Inactive
                        </option>
                      </select>
                    </label>

                  </div>


                  <div className="hostel-details-form-section">

                    <div className="hostel-details-section-heading">

                      <div>
                        <h3>
                          Manage Mess Units
                        </h3>

                        <p>
                          Add missing units, edit capacity and meal support, or mark existing units inactive.
                        </p>
                      </div>

                    </div>


                    <div className="hostel-details-mess-selection-grid">

                      {editForm.messUnits.map(
                        (unit) => (
                          <div
                            key={
                              unit.type
                            }
                            className={`hostel-details-mess-card ${
                              unit.selected
                                ? "selected"
                                : ""
                            }`}
                          >

                            <div className="hostel-details-mess-card-header">

                              <button
                                type="button"
                                className="hostel-details-edit-mess-toggle"
                                onClick={() =>
                                  toggleEditMessSelection(
                                    unit
                                  )
                                }
                              >
                                <span
                                  className={`hostel-details-checkbox-box ${
                                    unit.selected
                                      ? "checked"
                                      : ""
                                  }`}
                                >
                                  <Check
                                    size={14}
                                  />
                                </span>


                                <span className="hostel-details-mess-name">
                                  <UtensilsCrossed
                                    size={18}
                                  />

                                  {unit.name}
                                </span>
                              </button>


                              {unit.existingId && (
                                <span className="hostel-details-existing-badge">
                                  Existing
                                </span>
                              )}

                            </div>


                            {unit.selected && (
                              <div className="hostel-details-mess-fields">

                                <label>
                                  <span>
                                    Capacity
                                  </span>

                                  <input
                                    type="number"
                                    min="1"
                                    value={
                                      unit.capacity
                                    }
                                    onChange={(event) =>
                                      updateEditMessUnit(
                                        unit.type,
                                        "capacity",
                                        event.target.value
                                      )
                                    }
                                  />
                                </label>


                                <div className="hostel-details-support-options">

                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={
                                        Boolean(
                                          unit.supportsVeg
                                        )
                                      }
                                      onChange={(event) =>
                                        updateEditMessUnit(
                                          unit.type,
                                          "supportsVeg",
                                          event.target.checked
                                        )
                                      }
                                    />

                                    Supports Veg
                                  </label>


                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={
                                        Boolean(
                                          unit.supportsNonVeg
                                        )
                                      }
                                      onChange={(event) =>
                                        updateEditMessUnit(
                                          unit.type,
                                          "supportsNonVeg",
                                          event.target.checked
                                        )
                                      }
                                    />

                                    Supports Non-Veg
                                  </label>

                                </div>


                                {unit.existingId && (
                                  <label>
                                    <span>
                                      Mess Unit Status
                                    </span>

                                    <select
                                      value={
                                        unit.status
                                      }
                                      onChange={(event) =>
                                        updateEditMessUnit(
                                          unit.type,
                                          "status",
                                          event.target.value
                                        )
                                      }
                                    >
                                      <option value="active">
                                        Active
                                      </option>

                                      <option value="inactive">
                                        Inactive
                                      </option>
                                    </select>
                                  </label>
                                )}

                              </div>
                            )}


                            {!unit.selected &&
                              unit.existingId && (
                                <div className="hostel-details-deactivated-note">
                                  This existing Mess Unit will be marked Inactive. Its connected data will not be deleted.
                                </div>
                              )}

                          </div>
                        )
                      )}

                    </div>

                  </div>

                </div>


                <div className="hostel-details-modal-footer">

                  <button
                    type="button"
                    className="hostel-details-secondary-button"
                    onClick={
                      closeEditHostel
                    }
                    disabled={
                      savingEdit
                    }
                  >
                    Cancel
                  </button>


                  <button
                    type="submit"
                    className="hostel-details-primary-button"
                    disabled={
                      savingEdit
                    }
                  >

                    {savingEdit ? (
                      <Loader2
                        size={17}
                        className="spinning"
                      />
                    ) : (
                      <Save
                        size={17}
                      />
                    )}

                    {savingEdit
                      ? "Saving..."
                      : "Save Changes"}

                  </button>

                </div>

              </form>

            </div>

          </div>
        )}


      {/* =====================================================
          PERMANENT DELETE HOSTEL
      ===================================================== */}

      <PermanentDeleteModal
        isOpen={Boolean(
          deleteTarget
        )}
        onClose={
          closeDeleteHostel
        }
        onConfirm={
          permanentlyDeleteHostel
        }
        recordType="hostel"
        recordName={
          deleteTarget?.name || ""
        }
        details={[
          {
            label:
              "Hostel Code",
            value:
              deleteTarget?.code ||
              "—",
          },
          {
            label:
              "Students",
            value:
              Number(
                deleteTarget?.studentCount ||
                0
              ),
          },
          {
            label:
              "Staff",
            value:
              Number(
                deleteTarget?.staffCount ||
                0
              ),
          },
          {
            label:
              "Mess Units",
            value:
              Number(
                deleteTarget?.messUnitCount ??
                getMessUnits(
                  deleteTarget
                ).length
              ),
          },
          {
            label:
              "Menus",
            value:
              Number(
                deleteTarget?.menuCount ||
                0
              ),
          },
        ]}
        relatedItems={[
          "Student accounts assigned to this Hostel",
          "Staff accounts assigned to this Hostel",
          "Hostel Blocks and Mess Units",
          "Menus and Meal Responses belonging to this Hostel",
          "Forecast and Waste records belonging to this Hostel",
          "Other records exclusively owned by this Hostel",
        ]}
        warningMessage="This is a destructive cascade. Deleting this Hostel permanently removes the Hostel and its related Student, Staff, Block, Mess Unit, Menu, Meal Response, Forecast and Waste data. Your Manager account and your other Hostels are not deleted. This action cannot be undone."
        deleteButtonText="Permanently Delete Hostel"
        error={
          deleteError
        }
        isDeleting={
          deleteSaving
        }
      />

    </div>
  );
}


export default HostelDetails;