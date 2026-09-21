import assert from "node:assert/strict";
import test from "node:test";

import {
  existsSync,
  readFileSync,
} from "node:fs";

import path from "node:path";

import {
  fileURLToPath,
} from "node:url";


/* ============================================================
   PATHS
   ============================================================ */

const TEST_FILE =
  fileURLToPath(
    import.meta.url
  );


const TEST_DIR =
  path.dirname(
    TEST_FILE
  );


const FRONTEND_DIR =
  path.resolve(
    TEST_DIR,
    ".."
  );


const PERMANENT_DELETE_UTILITY_PATH =
  path.join(
    FRONTEND_DIR,
    "src",
    "utils",
    "permanentDelete.js"
  );


const PERMANENT_DELETE_MODAL_PATH =
  path.join(
    FRONTEND_DIR,
    "src",
    "components",
    "manager",
    "PermanentDeleteModal.jsx"
  );


const STUDENTS_PATH =
  path.join(
    FRONTEND_DIR,
    "src",
    "pages",
    "manager",
    "Students.jsx"
  );


const STAFF_PATH =
  path.join(
    FRONTEND_DIR,
    "src",
    "pages",
    "manager",
    "Staff.jsx"
  );


const HOSTEL_DETAILS_PATH =
  path.join(
    FRONTEND_DIR,
    "src",
    "pages",
    "manager",
    "HostelDetails.jsx"
  );


const MENU_MANAGEMENT_PATH =
  path.join(
    FRONTEND_DIR,
    "src",
    "pages",
    "manager",
    "MenuManagement.jsx"
  );


/* ============================================================
   FILE HELPERS
   ============================================================ */

function assertFileExists(
  filePath,
  description
) {
  assert.equal(
    existsSync(filePath),
    true,
    `${description} was not found at:\n${filePath}`
  );
}


function readSource(
  filePath,
  description
) {
  assertFileExists(
    filePath,
    description
  );


  return readFileSync(
    filePath,
    "utf8"
  );
}


function compactSource(
  source
) {
  return source
    .replace(
      /\r\n/g,
      "\n"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function sourceWindow(
  source,
  searchText,
  radius = 900
) {
  const index =
    source.indexOf(
      searchText
    );


  if (index === -1) {
    return "";
  }


  const start =
    Math.max(
      index - radius,
      0
    );


  const end =
    Math.min(
      index +
        searchText.length +
        radius,
      source.length
    );


  return source.slice(
    start,
    end
  );
}


/* ============================================================
   LOAD UTILITY AS ESM
   ============================================================ */

/*
 * Loading the utility through a data URL keeps this test
 * independent of package.json "type" configuration.
 *
 * No third-party test dependency is required.
 */

const permanentDeleteUtilitySource =
  readSource(
    PERMANENT_DELETE_UTILITY_PATH,
    "permanentDelete.js"
  );


const utilityModuleUrl =
  `data:text/javascript;base64,${
    Buffer
      .from(
        permanentDeleteUtilitySource,
        "utf8"
      )
      .toString(
        "base64"
      )
  }`;


const {
  PERMANENT_DELETE_CONFIRMATION,
  isPermanentDeleteConfirmationValid,
  buildPermanentDeleteBody,
  getPermanentDeleteErrorMessage,
  createPermanentDeleteRequestGuard,
} =
  await import(
    utilityModuleUrl
  );


/* ============================================================
   UTILITY TESTS
   ============================================================ */

test(
  "permanent delete confirmation constant is exact uppercase DELETE",
  () => {
    assert.equal(
      PERMANENT_DELETE_CONFIRMATION,
      "DELETE"
    );
  }
);


test(
  "only exact uppercase DELETE is accepted",
  () => {
    const invalidValues = [
      "",
      "delete",
      "Delete",
      "DElete",
      "DELETE ",
      " DELETE",
      " DELETE ",
      "delete ",
      "delete\n",
      "DELETE\n",
      "DELETE\t",
      null,
      undefined,
      123,
      true,
      {},
      [],
    ];


    for (
      const value
      of invalidValues
    ) {
      assert.equal(
        isPermanentDeleteConfirmationValid(
          value
        ),
        false,
        `Expected ${JSON.stringify(
          value
        )} to be rejected.`
      );
    }


    assert.equal(
      isPermanentDeleteConfirmationValid(
        "DELETE"
      ),
      true
    );
  }
);


test(
  "confirmation validation does not trim or change case",
  () => {
    assert.equal(
      isPermanentDeleteConfirmationValid(
        "DELETE"
      ),
      true
    );


    assert.equal(
      isPermanentDeleteConfirmationValid(
        " DELETE "
      ),
      false
    );


    assert.equal(
      isPermanentDeleteConfirmationValid(
        "delete"
      ),
      false
    );
  }
);


test(
  "delete request body contains the raw confirmation value",
  () => {
    assert.deepEqual(
      buildPermanentDeleteBody(
        "DELETE"
      ),
      {
        confirmation:
          "DELETE",
      }
    );


    /*
     * The helper must not silently
     * normalize an incorrect value.
     */

    assert.deepEqual(
      buildPermanentDeleteBody(
        " delete "
      ),
      {
        confirmation:
          " delete ",
      }
    );
  }
);


test(
  "request guard blocks duplicate permanent delete requests",
  () => {
    const guard =
      createPermanentDeleteRequestGuard();


    assert.equal(
      guard.isInFlight(),
      false
    );


    assert.equal(
      guard.tryStart(),
      true
    );


    assert.equal(
      guard.isInFlight(),
      true
    );


    /*
     * Second submission while the
     * first request is pending must
     * be rejected.
     */

    assert.equal(
      guard.tryStart(),
      false
    );


    assert.equal(
      guard.isInFlight(),
      true
    );


    guard.finish();


    assert.equal(
      guard.isInFlight(),
      false
    );


    /*
     * A later deletion is allowed
     * after the first request ends.
     */

    assert.equal(
      guard.tryStart(),
      true
    );


    guard.finish();


    assert.equal(
      guard.isInFlight(),
      false
    );
  }
);


test(
  "backend delete error message is preserved for the modal",
  () => {
    assert.equal(
      getPermanentDeleteErrorMessage(
        {
          message:
            "You do not have permission to delete this record.",
        }
      ),
      "You do not have permission to delete this record."
    );


    assert.equal(
      getPermanentDeleteErrorMessage(
        "Database operation failed."
      ),
      "Database operation failed."
    );


    assert.equal(
      getPermanentDeleteErrorMessage(
        null,
        "Fallback error."
      ),
      "Fallback error."
    );
  }
);


/* ============================================================
   MODAL CONTRACT TESTS
   ============================================================ */

const modalSource =
  readSource(
    PERMANENT_DELETE_MODAL_PATH,
    "PermanentDeleteModal.jsx"
  );


const compactModalSource =
  compactSource(
    modalSource
  );


test(
  "permanent delete modal uses the required warning title",
  () => {
    assert.match(
      compactModalSource,
      /Permanently delete this record\?/
    );
  }
);


test(
  "modal tells the Manager to type DELETE in uppercase",
  () => {
    assert.match(
      compactModalSource,
      /PERMANENT_DELETE_CONFIRMATION/
    );


    assert.match(
      compactModalSource,
      /in uppercase to confirm/
    );
  }
);


test(
  "final delete button depends on exact confirmation validity",
  () => {
    /*
     * This proves the component uses
     * the exact shared validator.
     */

    assert.match(
      compactModalSource,
      /isPermanentDeleteConfirmationValid\( confirmationText \)/
    );


    /*
     * The final button can only be
     * used when confirmation is valid
     * and there is no request pending.
     */

    assert.match(
      compactModalSource,
      /const canDelete = confirmationIsValid && !isDeleting/
    );


    assert.match(
      compactModalSource,
      /disabled=\{!canDelete\}/
    );
  }
);


test(
  "empty and incorrect confirmation leave final delete disabled",
  () => {
    const invalidInputs = [
      "",
      "delete",
      "Delete",
      "DELETE ",
      " DELETE",
    ];


    for (
      const value
      of invalidInputs
    ) {
      const valid =
        isPermanentDeleteConfirmationValid(
          value
        );


      const isDeleting =
        false;


      const canDelete =
        valid &&
        !isDeleting;


      assert.equal(
        canDelete,
        false,
        `Delete unexpectedly enabled for ${JSON.stringify(
          value
        )}`
      );
    }
  }
);


test(
  "exact DELETE enables the final action when no request is pending",
  () => {
    const valid =
      isPermanentDeleteConfirmationValid(
        "DELETE"
      );


    const isDeleting =
      false;


    const canDelete =
      valid &&
      !isDeleting;


    assert.equal(
      canDelete,
      true
    );
  }
);


test(
  "pending request disables final delete even with valid confirmation",
  () => {
    const valid =
      isPermanentDeleteConfirmationValid(
        "DELETE"
      );


    const isDeleting =
      true;


    const canDelete =
      valid &&
      !isDeleting;


    assert.equal(
      canDelete,
      false
    );
  }
);


test(
  "Cancel closes the modal without invoking permanent deletion",
  () => {
    const closeStart =
      modalSource.indexOf(
        "const closeModal"
      );


    const confirmStart =
      modalSource.indexOf(
        "const handleConfirm"
      );


    assert.notEqual(
      closeStart,
      -1,
      "closeModal function is missing."
    );


    assert.notEqual(
      confirmStart,
      -1,
      "handleConfirm function is missing."
    );


    assert.ok(
      confirmStart >
        closeStart,
      "Unable to isolate closeModal."
    );


    const closeFunction =
      modalSource.slice(
        closeStart,
        confirmStart
      );


    /*
     * Closing the dialog may call
     * onClose, but must never call
     * the delete callback.
     */

    assert.match(
      closeFunction,
      /onClose/
    );


    assert.doesNotMatch(
      closeFunction,
      /onConfirm/
    );


    /*
     * Cancel is connected to the
     * safe close function.
     */

    assert.match(
      compactModalSource,
      /className="permanent-delete-modal__cancel" onClick=\{closeModal\}/
    );
  }
);


test(
  "closing the modal clears typed confirmation",
  () => {
    const closeStart =
      modalSource.indexOf(
        "const closeModal"
      );


    const confirmStart =
      modalSource.indexOf(
        "const handleConfirm"
      );


    const closeFunction =
      modalSource.slice(
        closeStart,
        confirmStart
      );


    assert.match(
      compactSource(
        closeFunction
      ),
      /setConfirmationText\(""\)/
    );
  }
);


test(
  "clicking outside closes only when the backdrop itself is clicked",
  () => {
    assert.match(
      compactModalSource,
      /event\.target === event\.currentTarget/
    );


    assert.match(
      compactModalSource,
      /handleBackdropMouseDown/
    );
  }
);


test(
  "Escape closes the dialog while no delete request is pending",
  () => {
    assert.match(
      compactModalSource,
      /event\.key === "Escape"/
    );


    assert.match(
      compactModalSource,
      /if \(!isDeleting\) \{ closeModal\(\)/
    );
  }
);


test(
  "Cancel is disabled while the final delete request is pending",
  () => {
    const cancelWindow =
      sourceWindow(
        compactModalSource,
        'className="permanent-delete-modal__cancel"',
        250
      );


    assert.notEqual(
      cancelWindow,
      "",
      "Cancel button was not found."
    );


    assert.match(
      cancelWindow,
      /disabled=\{isDeleting\}/
    );
  }
);


test(
  "confirmation input is disabled while deleting",
  () => {
    const inputWindow =
      sourceWindow(
        compactModalSource,
        'id="permanent-delete-confirmation"',
        600
      );


    assert.notEqual(
      inputWindow,
      "",
      "Confirmation input was not found."
    );


    assert.match(
      inputWindow,
      /disabled=\{isDeleting\}/
    );
  }
);


test(
  "dialog includes accessible modal semantics",
  () => {
    assert.match(
      compactModalSource,
      /role="dialog"/
    );


    assert.match(
      compactModalSource,
      /aria-modal="true"/
    );


    assert.match(
      compactModalSource,
      /aria-labelledby="permanent-delete-title"/
    );


    assert.match(
      compactModalSource,
      /aria-describedby="permanent-delete-description"/
    );
  }
);


test(
  "dialog traps Tab and Shift+Tab focus",
  () => {
    assert.match(
      compactModalSource,
      /event\.key !== "Tab"/
    );


    assert.match(
      compactModalSource,
      /focusableElements/
    );


    assert.match(
      compactModalSource,
      /event\.shiftKey/
    );


    assert.match(
      compactModalSource,
      /firstElement/
    );


    assert.match(
      compactModalSource,
      /lastElement/
    );
  }
);


test(
  "dialog restores focus after it closes",
  () => {
    assert.match(
      compactModalSource,
      /previouslyFocusedElementRef/
    );


    assert.match(
      compactModalSource,
      /previousElement\.focus\(\)/
    );
  }
);


test(
  "dialog prevents background scrolling while open",
  () => {
    assert.match(
      compactModalSource,
      /document\.body\.style\.overflow/
    );


    assert.match(
      compactModalSource,
      /"hidden"/
    );
  }
);


/* ============================================================
   PAGE WIRING HELPERS
   ============================================================ */

function assertDeletePageWiring({
  source,
  pageName,
  openFunction,
  permanentFunction,
  endpointFragment,
}) {
  const compact =
    compactSource(
      source
    );


  assert.match(
    compact,
    /PermanentDeleteModal/
  );


  assert.match(
    compact,
    /manager-delete-action/
  );


  assert.ok(
    compact.includes(
      openFunction
    ),
    `${pageName} is missing ${openFunction}.`
  );


  assert.ok(
    compact.includes(
      permanentFunction
    ),
    `${pageName} is missing ${permanentFunction}.`
  );


  assert.ok(
    source.includes(
      endpointFragment
    ),
    `${pageName} is missing its Manager permanent-delete endpoint.`
  );


  assert.match(
    compact,
    /method: "DELETE"/
  );


  assert.match(
    compact,
    /buildPermanentDeleteBody\( confirmation \)/
  );


  assert.match(
    compact,
    /createPermanentDeleteRequestGuard/
  );


  assert.match(
    compact,
    /tryStart\(\)/
  );


  assert.match(
    compact,
    /finish\(\)/
  );
}


/* ============================================================
   STUDENTS PAGE
   ============================================================ */

const studentsSource =
  readSource(
    STUDENTS_PATH,
    "Students.jsx"
  );


test(
  "clicking Student Delete only opens the confirmation flow",
  () => {
    const compact =
      compactSource(
        studentsSource
      );


    const deleteButtonWindow =
      sourceWindow(
        compact,
        'className="manager-delete-action"',
        450
      );


    assert.match(
      deleteButtonWindow,
      /openDeleteStudent/
    );


    /*
     * The row button must not call
     * apiFetch directly.
     */

    assert.doesNotMatch(
      deleteButtonWindow,
      /apiFetch/
    );
  }
);


test(
  "Students page sends confirmation to the secure delete endpoint",
  () => {
    assertDeletePageWiring({
      source:
        studentsSource,

      pageName:
        "Students.jsx",

      openFunction:
        "openDeleteStudent",

      permanentFunction:
        "permanentlyDeleteStudent",

      endpointFragment:
        "/api/manager/students/${studentToDelete.id}",
    });
  }
);


/* ============================================================
   STAFF PAGE
   ============================================================ */

const staffSource =
  readSource(
    STAFF_PATH,
    "Staff.jsx"
  );


test(
  "clicking Staff Delete only opens the confirmation flow",
  () => {
    const compact =
      compactSource(
        staffSource
      );


    const deleteButtonWindow =
      sourceWindow(
        compact,
        'className="manager-delete-action"',
        450
      );


    assert.match(
      deleteButtonWindow,
      /openDeleteStaff/
    );


    assert.doesNotMatch(
      deleteButtonWindow,
      /apiFetch/
    );
  }
);


test(
  "Staff page sends confirmation to the secure delete endpoint",
  () => {
    assertDeletePageWiring({
      source:
        staffSource,

      pageName:
        "Staff.jsx",

      openFunction:
        "openDeleteStaff",

      permanentFunction:
        "permanentlyDeleteStaff",

      endpointFragment:
        "/api/manager/staff/${staffToDelete.id}",
    });
  }
);


/* ============================================================
   HOSTEL DETAILS PAGE
   ============================================================ */

const hostelDetailsSource =
  readSource(
    HOSTEL_DETAILS_PATH,
    "HostelDetails.jsx"
  );


test(
  "clicking Hostel Delete only opens the confirmation flow",
  () => {
    const compact =
      compactSource(
        hostelDetailsSource
      );


    const deleteButtonWindow =
      sourceWindow(
        compact,
        'className="manager-delete-action"',
        500
      );


    assert.match(
      deleteButtonWindow,
      /openDeleteHostel/
    );


    assert.doesNotMatch(
      deleteButtonWindow,
      /apiFetch/
    );
  }
);


test(
  "Hostel Details page sends confirmation to the secure delete endpoint",
  () => {
    assertDeletePageWiring({
      source:
        hostelDetailsSource,

      pageName:
        "HostelDetails.jsx",

      openFunction:
        "openDeleteHostel",

      permanentFunction:
        "permanentlyDeleteHostel",

      endpointFragment:
        "/api/manager/hostels/${hostelToDelete.id}",
    });
  }
);


test(
  "Hostel permanent-delete warning describes destructive dependent data",
  () => {
    const compact =
      compactSource(
        hostelDetailsSource
      );


    assert.match(
      compact,
      /Student accounts assigned to this Hostel/
    );


    assert.match(
      compact,
      /Staff accounts assigned to this Hostel/
    );


    assert.match(
      compact,
      /Hostel Blocks and Mess Units/
    );


    assert.match(
      compact,
      /Menus and Meal Responses belonging to this Hostel/
    );


    assert.match(
      compact,
      /Forecast and Waste records belonging to this Hostel/
    );


    assert.match(
      compact,
      /Manager account and your other Hostels are not deleted/
    );
  }
);


/* ============================================================
   MENU MANAGEMENT PAGE
   ============================================================ */

const menuManagementSource =
  readSource(
    MENU_MANAGEMENT_PATH,
    "MenuManagement.jsx"
  );


test(
  "clicking Menu Delete only opens the confirmation flow",
  () => {
    const compact =
      compactSource(
        menuManagementSource
      );


    const deleteButtonWindow =
      sourceWindow(
        compact,
        'className="manager-delete-action"',
        500
      );


    assert.match(
      deleteButtonWindow,
      /openDeleteMenu/
    );


    assert.doesNotMatch(
      deleteButtonWindow,
      /apiFetch/
    );
  }
);


test(
  "Menu Management sends confirmation to the secure delete endpoint",
  () => {
    assertDeletePageWiring({
      source:
        menuManagementSource,

      pageName:
        "MenuManagement.jsx",

      openFunction:
        "openDeleteMenu",

      permanentFunction:
        "permanentlyDeleteMenu",

      endpointFragment:
        "/api/manager/menus/${menuToDelete.id}",
    });
  }
);


test(
  "Menu Delete is no longer limited to Draft status",
  () => {
    const compact =
      compactSource(
        menuManagementSource
      );


    const actionWindow =
      sourceWindow(
        compact,
        'className="manager-delete-action"',
        650
      );


    assert.notEqual(
      actionWindow,
      "",
      "Menu permanent Delete action was not found."
    );


    /*
     * The Delete button itself must
     * not be wrapped in the old
     * Draft-only condition.
     */

    assert.doesNotMatch(
      actionWindow,
      /normalizeStatus\( menu\.status \) === "draft"/
    );


    assert.doesNotMatch(
      compact,
      /Delete Draft Menu\?/
    );


    assert.doesNotMatch(
      compact,
      /Delete Draft/
    );


    assert.match(
      compact,
      /Draft, Scheduled, Published or Completed/
    );
  }
);


test(
  "Menu permanent-delete warning preserves unrelated forecast and waste history",
  () => {
    const compact =
      compactSource(
        menuManagementSource
      );


    assert.match(
      compact,
      /Meal responses directly linked to this Menu/
    );


    assert.match(
      compact,
      /Forecast and Waste history that is not directly linked to this Menu will be preserved/
    );
  }
);


/* ============================================================
   NO FULL APP RELOAD / AUTH CLEARING
   ============================================================ */

test(
  "permanent-delete page handlers do not reload the complete application",
  () => {
    const sources = [
      [
        "Students.jsx",
        studentsSource,
      ],
      [
        "Staff.jsx",
        staffSource,
      ],
      [
        "HostelDetails.jsx",
        hostelDetailsSource,
      ],
      [
        "MenuManagement.jsx",
        menuManagementSource,
      ],
    ];


    for (
      const [
        pageName,
        source,
      ]
      of sources
    ) {
      assert.doesNotMatch(
        source,
        /window\.location\.reload\s*\(/
        ,
        `${pageName} must not reload the full application after deletion.`
      );


      assert.doesNotMatch(
        source,
        /localStorage\.clear\s*\(/
        ,
        `${pageName} must not clear authentication during deletion.`
      );


      assert.doesNotMatch(
        source,
        /sessionStorage\.clear\s*\(/
        ,
        `${pageName} must not clear authentication during deletion.`
      );
    }
  }
);


/* ============================================================
   FINAL CONTRACT
   ============================================================ */

test(
  "all four Manager resource pages use the same reusable permanent-delete modal",
  () => {
    const sources = [
      studentsSource,
      staffSource,
      hostelDetailsSource,
      menuManagementSource,
    ];


    for (
      const source
      of sources
    ) {
      assert.match(
        source,
        /PermanentDeleteModal/
      );


      assert.match(
        source,
        /isOpen=\{Boolean\(/
      );


      assert.match(
        source,
        /onConfirm=\{/
      );


      assert.match(
        source,
        /isDeleting=\{/
      );
    }
  }
);