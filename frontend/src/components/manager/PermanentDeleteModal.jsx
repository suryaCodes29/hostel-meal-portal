import {
  AlertTriangle,
  LoaderCircle,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  isPermanentDeleteConfirmationValid,
  PERMANENT_DELETE_CONFIRMATION,
} from "../../utils/permanentDelete";

import "./permanentDeleteModal.css";


const DEFAULT_TITLE =
  "Permanently delete this record?";


function PermanentDeleteModal({
  isOpen,
  onClose,
  onConfirm,

  title = DEFAULT_TITLE,

  recordType = "record",
  recordName = "",

  details = [],
  relatedItems = [],

  warningMessage =
    "This action cannot be undone.",

  deleteButtonText =
    "Permanently Delete",

  error = "",
  isDeleting = false,
}) {
  const dialogRef =
    useRef(null);

  const inputRef =
    useRef(null);

  const previouslyFocusedElementRef =
    useRef(null);

  const [confirmationText, setConfirmationText] =
    useState("");


  const normalizedDetails =
    useMemo(() => {
      if (!Array.isArray(details)) {
        return [];
      }

      return details.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          item.label &&
          item.value !== undefined &&
          item.value !== null &&
          String(item.value).trim() !== ""
      );
    }, [details]);


  const normalizedRelatedItems =
    useMemo(() => {
      if (!Array.isArray(relatedItems)) {
        return [];
      }

      return relatedItems.filter(
        (item) =>
          typeof item === "string" &&
          item.trim() !== ""
      );
    }, [relatedItems]);


  const confirmationIsValid =
    isPermanentDeleteConfirmationValid(
      confirmationText
    );


  const canDelete =
    confirmationIsValid &&
    !isDeleting;


  const closeModal = () => {
    if (isDeleting) {
      return;
    }

    setConfirmationText("");

    if (
      typeof onClose === "function"
    ) {
      onClose();
    }
  };


  const handleConfirm = async () => {
    if (
      !canDelete ||
      typeof onConfirm !== "function"
    ) {
      return;
    }

    await onConfirm(
      confirmationText
    );
  };


  const handleBackdropMouseDown =
    (event) => {
      if (
        event.target ===
        event.currentTarget
      ) {
        closeModal();
      }
    };


  const handleInputChange =
    (event) => {
      setConfirmationText(
        event.target.value
      );
    };


  /*
   * Reset the confirmation whenever
   * the dialog opens/closes.
   */
  useEffect(() => {
    if (!isOpen) {
      setConfirmationText("");
      return;
    }

    previouslyFocusedElementRef.current =
      document.activeElement;

    const focusTimer =
      window.setTimeout(
        () => {
          inputRef.current?.focus();
        },
        0
      );

    return () => {
      window.clearTimeout(
        focusTimer
      );

      const previousElement =
        previouslyFocusedElementRef.current;

      if (
        previousElement &&
        typeof previousElement.focus ===
          "function"
      ) {
        window.setTimeout(
          () => {
            previousElement.focus();
          },
          0
        );
      }
    };
  }, [isOpen]);


  /*
   * Escape support + keyboard focus trap.
   */
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown =
      (event) => {
        if (
          event.key === "Escape"
        ) {
          event.preventDefault();

          if (!isDeleting) {
            closeModal();
          }

          return;
        }

        if (
          event.key !== "Tab"
        ) {
          return;
        }

        const dialog =
          dialogRef.current;

        if (!dialog) {
          return;
        }

        const focusableElements =
          Array.from(
            dialog.querySelectorAll(
              [
                "button:not([disabled])",
                "input:not([disabled])",
                "select:not([disabled])",
                "textarea:not([disabled])",
                "[href]",
                '[tabindex]:not([tabindex="-1"])',
              ].join(",")
            )
          ).filter(
            (element) =>
              !element.hasAttribute(
                "aria-hidden"
              )
          );

        if (
          focusableElements.length ===
          0
        ) {
          event.preventDefault();
          return;
        }

        const firstElement =
          focusableElements[0];

        const lastElement =
          focusableElements[
            focusableElements.length -
              1
          ];

        const activeElement =
          document.activeElement;

        if (
          event.shiftKey &&
          activeElement ===
            firstElement
        ) {
          event.preventDefault();

          lastElement.focus();

          return;
        }

        if (
          !event.shiftKey &&
          activeElement ===
            lastElement
        ) {
          event.preventDefault();

          firstElement.focus();
        }
      };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    isOpen,
    isDeleting,
  ]);


  /*
   * Prevent page behind the modal
   * from scrolling.
   */
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isOpen]);


  if (!isOpen) {
    return null;
  }


  return (
    <div
      className="permanent-delete-backdrop"
      onMouseDown={
        handleBackdropMouseDown
      }
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="permanent-delete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="permanent-delete-title"
        aria-describedby="permanent-delete-description"
      >
        <div className="permanent-delete-modal__header">
          <div className="permanent-delete-modal__warning-icon">
            <AlertTriangle
              size={26}
              aria-hidden="true"
            />
          </div>

          <div className="permanent-delete-modal__heading">
            <h2
              id="permanent-delete-title"
              className="permanent-delete-modal__title"
            >
              {title}
            </h2>

            <p
              id="permanent-delete-description"
              className="permanent-delete-modal__subtitle"
            >
              You are about to
              permanently delete this{" "}
              {recordType}.
            </p>
          </div>

          <button
            type="button"
            className="permanent-delete-modal__close"
            onClick={closeModal}
            disabled={isDeleting}
            aria-label="Close delete confirmation"
            title="Close"
          >
            <X
              size={20}
              aria-hidden="true"
            />
          </button>
        </div>


        <div className="permanent-delete-modal__body">
          {recordName ? (
            <div className="permanent-delete-modal__record">
              <span className="permanent-delete-modal__record-label">
                Selected{" "}
                {recordType}
              </span>

              <strong className="permanent-delete-modal__record-name">
                {recordName}
              </strong>
            </div>
          ) : null}


          {normalizedDetails.length >
          0 ? (
            <div className="permanent-delete-modal__details">
              {normalizedDetails.map(
                (
                  item,
                  index
                ) => (
                  <div
                    className="permanent-delete-modal__detail-row"
                    key={`${item.label}-${index}`}
                  >
                    <span className="permanent-delete-modal__detail-label">
                      {item.label}
                    </span>

                    <span className="permanent-delete-modal__detail-value">
                      {String(
                        item.value
                      )}
                    </span>
                  </div>
                )
              )}
            </div>
          ) : null}


          {normalizedRelatedItems.length >
          0 ? (
            <div className="permanent-delete-modal__related">
              <p className="permanent-delete-modal__section-title">
                The following related
                information will also
                be removed:
              </p>

              <ul className="permanent-delete-modal__related-list">
                {normalizedRelatedItems.map(
                  (
                    item,
                    index
                  ) => (
                    <li
                      key={`${item}-${index}`}
                    >
                      {item}
                    </li>
                  )
                )}
              </ul>
            </div>
          ) : null}


          <div className="permanent-delete-modal__warning">
            <AlertTriangle
              size={18}
              aria-hidden="true"
            />

            <p>
              {warningMessage}
            </p>
          </div>


          <div className="permanent-delete-modal__confirmation">
            <label
              htmlFor="permanent-delete-confirmation"
              className="permanent-delete-modal__confirmation-label"
            >
              Type{" "}
              <strong>
                {
                  PERMANENT_DELETE_CONFIRMATION
                }
              </strong>{" "}
              in uppercase to
              confirm
            </label>

            <input
              ref={inputRef}
              id="permanent-delete-confirmation"
              type="text"
              className={`permanent-delete-modal__confirmation-input${
                confirmationText &&
                !confirmationIsValid
                  ? " permanent-delete-modal__confirmation-input--invalid"
                  : ""
              }`}
              value={
                confirmationText
              }
              onChange={
                handleInputChange
              }
              disabled={isDeleting}
              autoComplete="off"
              spellCheck="false"
              aria-invalid={
                confirmationText &&
                !confirmationIsValid
                  ? "true"
                  : "false"
              }
              aria-describedby="permanent-delete-confirmation-help"
              placeholder="DELETE"
            />

            <p
              id="permanent-delete-confirmation-help"
              className="permanent-delete-modal__confirmation-help"
            >
              The confirmation is
              case-sensitive. Only
              exact uppercase{" "}
              <strong>
                DELETE
              </strong>{" "}
              is accepted.
            </p>
          </div>


          {error ? (
            <div
              className="permanent-delete-modal__error"
              role="alert"
            >
              <AlertTriangle
                size={17}
                aria-hidden="true"
              />

              <span>
                {error}
              </span>
            </div>
          ) : null}
        </div>


        <div className="permanent-delete-modal__footer">
          <button
            type="button"
            className="permanent-delete-modal__cancel"
            onClick={closeModal}
            disabled={isDeleting}
          >
            Cancel
          </button>

          <button
            type="button"
            className="permanent-delete-modal__delete"
            onClick={
              handleConfirm
            }
            disabled={!canDelete}
          >
            {isDeleting ? (
              <>
                <LoaderCircle
                  className="permanent-delete-modal__spinner"
                  size={18}
                  aria-hidden="true"
                />

                Deleting...
              </>
            ) : (
              <>
                <Trash2
                  size={18}
                  aria-hidden="true"
                />

                {
                  deleteButtonText
                }
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


export default PermanentDeleteModal;