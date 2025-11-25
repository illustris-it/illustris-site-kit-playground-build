// src/scripts/themekit.ts

interface ThemePreset {
    id: string;
    label: string;
    dawn1: string;
    dawn2: string;
    dusk1: string;
    dusk2: string;
}

interface ThemeState {
    themeId: string;
    scheme: "dark" | "light";
    bg: "soft" | "bold" | "clean";
    aurora: boolean;
    noise: boolean;
    colors: {
        dawn1: string;
        dawn2: string;
        dusk1: string;
        dusk2: string;
    };
}

(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const modal = document.getElementById("themeModal");
    const fab = document.getElementById("tmkFab");

    if (!modal || !fab) return;

    const storageKey =
        modal.getAttribute("data-storage-key") || "site-kit-theme";

    const presetsRaw = modal.getAttribute("data-presets");
    let presets: ThemePreset[] = [];

    try {
        presets = presetsRaw ? (JSON.parse(presetsRaw) as ThemePreset[]) : [];
    } catch {
        presets = [];
    }

    if (!presets.length) {
        // Safety default if something goes wrong
        presets = [
            {
                id: "mcx",
                label: "MCX",
                dawn1: "#D62DA5",
                dawn2: "#FA12A0",
                dusk1: "#45AAD0",
                dusk2: "#00E5FF",
            },
        ];
    }

    const presetSelect = document.getElementById(
        "tmkPreset"
    ) as HTMLSelectElement | null;
    const schemeField = document.getElementById("tmkScheme");
    const bgField = document.getElementById("tmkBg");
    const auroraCheckbox = document.getElementById(
        "tmkAurora"
    ) as HTMLInputElement | null;
    const noiseCheckbox = document.getElementById(
        "tmkNoise"
    ) as HTMLInputElement | null;

    const colorBlocks = Array.from(
        modal.querySelectorAll<HTMLElement>(".tmk-color")
    );

    const btnReset = modal.querySelector<HTMLElement>("[data-tmk='reset']");
    const btnCopy = modal.querySelector<HTMLElement>("[data-tmk='copy']");
    const closeEls = modal.querySelectorAll<HTMLElement>("[data-tmk='close']");
    const backdrop = modal.querySelector<HTMLElement>(".tmk-backdrop");

    // --------- Helpers ---------
    const findPreset = (id: string): ThemePreset | undefined =>
        presets.find((p) => p.id === id);

    const getPresetOrDefault = (id?: string | null): ThemePreset =>
        findPreset(id ?? "") || presets[0];

    const isHex = (value: unknown): value is string =>
        typeof value === "string" && /^#([0-9a-fA-F]{6})$/.test(value.trim());

    const readCssVar = (name: string, fallback: string): string => {
        try {
            const val = getComputedStyle(root).getPropertyValue(name).trim();
            return val || fallback;
        } catch {
            return fallback;
        }
    };

    const initialPreset = getPresetOrDefault(root.dataset.theme);

    const initialScheme =
        (root.dataset.scheme as ThemeState["scheme"]) || "dark";

    const initialBg =
        (root.dataset.bg as ThemeState["bg"]) || "bold";

    const initialAuroraHidden = !!document
        .querySelector<HTMLElement>(".bg-aurora")
        ?.hasAttribute("hidden");

    const initialNoiseHidden = !!document
        .querySelector<HTMLElement>(".bg-noise")
        ?.hasAttribute("hidden");

    const defaultState: ThemeState = {
        themeId: initialPreset.id,
        scheme: initialScheme,
        bg: initialBg,
        aurora: !initialAuroraHidden,
        noise: !initialNoiseHidden,
        colors: {
            dawn1: readCssVar("--dawn-1", initialPreset.dawn1),
            dawn2: readCssVar("--dawn-2", initialPreset.dawn2),
            dusk1: readCssVar("--dusk-1", initialPreset.dusk1),
            dusk2: readCssVar("--dusk-2", initialPreset.dusk2),
        },
    };

    const coerceState = (partial: Partial<ThemeState>): ThemeState => {
        const preset = getPresetOrDefault(partial.themeId);
        const scheme: ThemeState["scheme"] =
            partial.scheme === "light"
                ? "light"
                : partial.scheme === "dark"
                  ? "dark"
                  : defaultState.scheme;
        const bg: ThemeState["bg"] =
            partial.bg === "soft" || partial.bg === "clean" || partial.bg === "bold"
                ? partial.bg
                : defaultState.bg;

        const defaultColors = {
            dawn1: preset.dawn1,
            dawn2: preset.dawn2,
            dusk1: preset.dusk1,
            dusk2: preset.dusk2,
            ...defaultState.colors,
        };

        const mergedColors = {
            ...defaultColors,
            ...(partial.colors || {}),
        };

        const colors: ThemeState["colors"] = {
            dawn1: isHex(mergedColors.dawn1) ? mergedColors.dawn1 : preset.dawn1,
            dawn2: isHex(mergedColors.dawn2) ? mergedColors.dawn2 : preset.dawn2,
            dusk1: isHex(mergedColors.dusk1) ? mergedColors.dusk1 : preset.dusk1,
            dusk2: isHex(mergedColors.dusk2) ? mergedColors.dusk2 : preset.dusk2,
        };

        return {
            themeId: preset.id,
            scheme,
            bg,
            aurora:
                partial.aurora === undefined
                    ? defaultState.aurora
                    : !!partial.aurora,
            noise:
                partial.noise === undefined
                    ? defaultState.noise
                    : !!partial.noise,
            colors,
        };
    };

    const loadState = (): ThemeState => {
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) return defaultState;
            const parsed = JSON.parse(raw) as Partial<ThemeState>;
            return coerceState(parsed);
        } catch {
            return defaultState;
        }
    };

    const saveState = (state: ThemeState) => {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(state));
        } catch {
            /* ignore */
        }
    };

    // --------- Apply to DOM ---------
    const applyColorsToRoot = (colors: ThemeState["colors"]) => {
        root.style.setProperty("--dawn-1", colors.dawn1);
        root.style.setProperty("--dawn-2", colors.dawn2);
        root.style.setProperty("--dusk-1", colors.dusk1);
        root.style.setProperty("--dusk-2", colors.dusk2);
        // Optional: override accents as well
        // root.style.setProperty("--accent", colors.dawn2);
        // root.style.setProperty("--accent-2", colors.dawn1);
    };

    const applyStateToDOM = (state: ThemeState) => {
        // html data- attributes (these drive sitekit.css)
        root.setAttribute("data-theme", state.themeId);
        root.setAttribute("data-scheme", state.scheme);
        root.setAttribute("data-bg", state.bg);

        // Aurora/noise toggles: show/hide BG layers
        const auroraEl = document.querySelector<HTMLElement>(".bg-aurora");
        const noiseEl = document.querySelector<HTMLElement>(".bg-noise");

        if (auroraEl) {
            if (state.aurora) auroraEl.removeAttribute("hidden");
            else auroraEl.setAttribute("hidden", "");
        }
        if (noiseEl) {
            if (state.noise) noiseEl.removeAttribute("hidden");
            else noiseEl.setAttribute("hidden", "");
        }

        // Color inputs UI
        const colorMap: Record<string, string> = {
            "--dawn-1": state.colors.dawn1,
            "--dawn-2": state.colors.dawn2,
            "--dusk-1": state.colors.dusk1,
            "--dusk-2": state.colors.dusk2,
        };

        colorBlocks.forEach((block) => {
            const varName = block.getAttribute("data-var");
            if (!varName) return;
            const input = block.querySelector<HTMLInputElement>("input[type='color']");
            const valEl = block.querySelector<HTMLElement>(".val");
            const hex = colorMap[varName];
            if (input && hex) input.value = hex;
            if (valEl && hex) valEl.textContent = hex.toUpperCase();
        });

        // Scheme radios
        if (schemeField) {
            const radios = schemeField.querySelectorAll<HTMLInputElement>(
                "input[type='radio'][name='scheme']"
            );
            radios.forEach((r) => {
                r.checked = r.value === state.scheme;
            });
        }

        // BG radios
        if (bgField) {
            const radios = bgField.querySelectorAll<HTMLInputElement>(
                "input[type='radio'][name='bg']"
            );
            radios.forEach((r) => {
                r.checked = r.value === state.bg;
            });
        }

        if (auroraCheckbox) auroraCheckbox.checked = state.aurora;
        if (noiseCheckbox) noiseCheckbox.checked = state.noise;

        applyColorsToRoot(state.colors);
    };

    // --------- Modal open/close ---------
    const openModal = () => {
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
    };

    const closeModal = () => {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
    };

    fab.addEventListener("click", () => openModal());
    closeEls.forEach((el) =>
        el.addEventListener("click", () => closeModal())
    );
    backdrop?.addEventListener("click", () => closeModal());

    // --------- Init from state ---------
    let state = loadState();
    applyStateToDOM(state);

    // Sync preset select
    if (presetSelect) {
        presetSelect.value = state.themeId;
    }

    // --------- Event handlers ---------
    // Preset change → apply preset colors & theme id
    presetSelect?.addEventListener("change", () => {
        const id = presetSelect.value;
        const preset = findPreset(id);
        if (!preset) return;
        state = {
            ...state,
            themeId: id,
            colors: {
                dawn1: preset.dawn1,
                dawn2: preset.dawn2,
                dusk1: preset.dusk1,
                dusk2: preset.dusk2,
            },
        };
        applyStateToDOM(state);
        saveState(state);
    });

    // Color inputs
    colorBlocks.forEach((block) => {
        const varName = block.getAttribute("data-var") as
            | "--dawn-1"
            | "--dawn-2"
            | "--dusk-1"
            | "--dusk-2"
            | null;
        if (!varName) return;
        const input = block.querySelector<HTMLInputElement>("input[type='color']");
        const valEl = block.querySelector<HTMLElement>(".val");

        if (!input) return;

        input.addEventListener("input", () => {
            const hex = input.value;
            if (!hex) return;

            if (valEl) valEl.textContent = hex.toUpperCase();

            const newColors = { ...state.colors };
            if (varName === "--dawn-1") newColors.dawn1 = hex;
            if (varName === "--dawn-2") newColors.dawn2 = hex;
            if (varName === "--dusk-1") newColors.dusk1 = hex;
            if (varName === "--dusk-2") newColors.dusk2 = hex;

            state = { ...state, colors: newColors };
            applyColorsToRoot(state.colors);
            saveState(state);
        });
    });

    // Scheme radios
    schemeField?.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement | null;
        if (!target || target.name !== "scheme") return;
        const value = target.value === "light" ? "light" : "dark";
        state = { ...state, scheme: value };
        applyStateToDOM(state);
        saveState(state);
    });

    // BG radios
    bgField?.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement | null;
        if (!target || target.name !== "bg") return;
        const value =
            target.value === "soft" || target.value === "clean"
                ? (target.value as ThemeState["bg"])
                : "bold";
        state = { ...state, bg: value };
        applyStateToDOM(state);
        saveState(state);
    });

    auroraCheckbox?.addEventListener("change", () => {
        state = { ...state, aurora: !!auroraCheckbox.checked };
        applyStateToDOM(state);
        saveState(state);
    });

    noiseCheckbox?.addEventListener("change", () => {
        state = { ...state, noise: !!noiseCheckbox.checked };
        applyStateToDOM(state);
        saveState(state);
    });

    // Reset
    btnReset?.addEventListener("click", () => {
        state = { ...defaultState };
        applyStateToDOM(state);
        saveState(state);
        if (presetSelect) presetSelect.value = state.themeId;
    });

    // Copy CSS → clipboard
    btnCopy?.addEventListener("click", async () => {
        const { themeId, colors } = state;
        const css = [
            `html[data-theme="${themeId}"] {`,
            `  --dawn-1: ${colors.dawn1};`,
            `  --dawn-2: ${colors.dawn2};`,
            `  --dusk-1: ${colors.dusk1};`,
            `  --dusk-2: ${colors.dusk2};`,
            `  --accent: var(--dawn-2);`,
            `  --accent-2: var(--dawn-1);`,
            `}`,
            "",
        ].join("\n");

        try {
            await navigator.clipboard.writeText(css);
            btnCopy.textContent = "Copiato!";
            setTimeout(() => {
                btnCopy.textContent = "Copia CSS";
            }, 1400);
        } catch {
            console.warn("Clipboard not available");
        }
    });
})();
