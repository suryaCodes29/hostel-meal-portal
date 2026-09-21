const SETTINGS_STORAGE_KEY =
  "managerPortalSettings";


export function applySavedManagerTheme() {
  try {
    const stored =
      localStorage.getItem(
        SETTINGS_STORAGE_KEY
      );


    if (!stored) {
      document.documentElement.dataset.managerTheme =
        "light";

      document.documentElement.classList.remove(
        "manager-compact-mode"
      );

      return;
    }


    const settings =
      JSON.parse(stored);


    const mode =
      settings?.appearance?.mode ===
      "dark"
        ? "dark"
        : "light";


    const compact =
      Boolean(
        settings
          ?.appearance
          ?.compactMode
      );


    document.documentElement.dataset.managerTheme =
      mode;


    if (compact) {
      document.documentElement.classList.add(
        "manager-compact-mode"
      );
    } else {
      document.documentElement.classList.remove(
        "manager-compact-mode"
      );
    }

  } catch (error) {
    console.error(
      "Unable to apply saved Manager theme:",
      error
    );


    document.documentElement.dataset.managerTheme =
      "light";

    document.documentElement.classList.remove(
      "manager-compact-mode"
    );
  }
}