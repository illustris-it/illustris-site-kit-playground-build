// Header Nav (production): mobile drawer, focus-trap, scroll-lock, submenus, language menu
(() => {
    const html = document.documentElement;
    const header = document.querySelector<HTMLElement>("[data-header]");
    if (!header) return;

    const nav = header.querySelector<HTMLElement>(
        "[data-drawer-panel],[data-nav]"
    );
    const burger = header.querySelector<HTMLButtonElement>(
        "[data-drawer-trigger],[data-burger]"
    );
    const backdrop = header.querySelector<HTMLElement>(
        "[data-drawer-scrim],[data-nav-backdrop]"
    );
    const main = document.getElementById("main") as HTMLElement | null;

    // All toggles (mobile submenus + language)
    const subtoggles = Array.from(
        header.querySelectorAll<HTMLElement>("[data-subtoggle]")
    );

    const state = {
        open: false,
        lastFocus: null as HTMLElement | null,
        scrollLockActive: false,
    };

    const STORAGE_KEY = "nav-open-panels";

    /* Persist which submenu panels are open (by id) */
    const saveOpenPanels = () => {
        const openIds: string[] = [];
        document
            .querySelectorAll<HTMLElement>(".submenu[data-open='true']")
            .forEach((p) => p.id && openIds.push(p.id));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(openIds));
    };

    const restoreOpenPanels = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const openIds = JSON.parse(raw) as string[];
            openIds.forEach((id) => {
                const panel = document.getElementById(id);
                if (!panel) return;
                panel.setAttribute("data-open", "true");
                const btn = document.querySelector<HTMLElement>(`[aria-controls="${id}"]`);
                btn?.setAttribute("aria-expanded", "true");
            });
        } catch {
            /* ignore */
        }
    };

    const isDesktop = () => window.matchMedia("(min-width: 960px)").matches;

    /* ---------- Scroll lock ---------- */
    const lockScroll = () => {
        if (state.scrollLockActive) return;
        const sbw = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
        document.body.style.paddingRight = sbw > 0 ? `${sbw}px` : "";
        state.scrollLockActive = true;
    };
    const unlockScroll = () => {
        if (!state.scrollLockActive) return;
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
        document.body.style.paddingRight = "";
        state.scrollLockActive = false;
    };

    /* ---------- Focus trap ---------- */
    let trapHandler: ((e: KeyboardEvent) => void) | null = null;

    const focusTrap = (enable: boolean) => {
        if (enable) {
            if (trapHandler) return;
            trapHandler = (e: KeyboardEvent) => {
                if (!state.open || !nav) return;
                if (e.key === "Escape") {
                    e.preventDefault();
                    closeNav();
                    return;
                }
                if (e.key !== "Tab") return;

                const focusables = nav.querySelectorAll<HTMLElement>(
                    'a, button, [tabindex]:not([tabindex="-1"])'
                );
                const list = Array.from(focusables).filter(
                    (el) => !el.hasAttribute("disabled") &&
                        !el.hasAttribute("aria-hidden")
                );
                if (list.length === 0) return;

                const first = list[0],
                    last = list[list.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            };

            state.lastFocus = (document.activeElement as HTMLElement) || null;
            document.addEventListener("keydown", trapHandler);
            // hide background from SRs (modern browsers support inert)
            main?.setAttribute("inert", "");
            main?.setAttribute("aria-hidden", "true");
        } else {
            if (trapHandler) {
                document.removeEventListener("keydown", trapHandler);
                trapHandler = null;
            }
            main?.removeAttribute("inert");
            main?.removeAttribute("aria-hidden");
            state.lastFocus?.focus();
            state.lastFocus = null;
        }
    };

    /* ---------- Open / Close ---------- */
    const openNav = () => {
        if (state.open) return;
        state.open = true;
        html.setAttribute("data-nav-open", "true");
        burger?.setAttribute("aria-expanded", "true");
        backdrop?.removeAttribute("hidden");
        if (!isDesktop()) {
            lockScroll();
        }
        focusTrap(true);

        restoreOpenPanels();

        const first = nav?.querySelector<HTMLElement>(
            ".nav__link, .nav__link--parent, .submenu__link, [data-subtoggle]"
        );
        first?.focus();
    };

    const closeNav = () => {
        if (!state.open) return;
        state.open = false;
        html.removeAttribute("data-nav-open");
        burger?.setAttribute("aria-expanded", "false");
        backdrop?.setAttribute("hidden", "");
        if (state.scrollLockActive) {
            unlockScroll();
        }
        focusTrap(false);
        burger?.focus();
    };

    /* ---------- Submenus ---------- */
    const closeAllSubmenus = () => {
        subtoggles.forEach((btn) => {
            btn.setAttribute("aria-expanded", "false");
            const id = btn.getAttribute("aria-controls");
            if (!id) return;
            document.getElementById(id)?.setAttribute("data-open", "false");
        });
    };

    const toggleSubmenu = (el: HTMLElement) => {
        const id = el.getAttribute("aria-controls");
        if (!id) return;
        const panel = document.getElementById(id);
        if (!panel) return;

        const willOpen = el.getAttribute("aria-expanded") !== "true";

        // close siblings
        subtoggles.forEach(sib => {
            if (sib !== el) {
                sib.setAttribute("aria-expanded", "false");
                const sibId = sib.getAttribute("aria-controls");
                sibId && document.getElementById(sibId)?.setAttribute("data-open", "false");
            }
        });

        el.setAttribute("aria-expanded", willOpen ? "true" : "false");
        panel.setAttribute("data-open", willOpen ? "true" : "false");

        saveOpenPanels();
    };

    /* ---------- Events ---------- */
    burger?.addEventListener("click", () => (state.open ? closeNav() : openNav()));
    backdrop?.addEventListener("click", closeNav);

    // delegate toggles
    header.addEventListener("click", (e) => {
        const target = e.target as HTMLElement | null;
        const el = target?.closest<HTMLElement>("[data-subtoggle]");
        if (el) {
            // On mobile, parent anchor should toggle and NOT navigate
            if (!isDesktop() && el.matches("a[data-desktop-parent]")) {
                e.preventDefault();
                e.stopPropagation();
            }
            toggleSubmenu(el);
        }
    });


    // close on outside click:
    // - if drawer is open (mobile): close only the drawer (keep submenu state)
    // - if drawer is closed (desktop): close any click-open submenus (e.g., language)
    document.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        const inHeader = !!t.closest("[data-header]");
        if (inHeader) return;

        if (state.open) {
            closeNav(); // keep persisted open panels intact
        } else {
            closeAllSubmenus(); // desktop: close click-open panels
        }
    });

    // close drawer only on real leaf links (not parent link), and only on mobile
    document.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        const a = t.closest<HTMLAnchorElement>(".nav a");
        if (!a) return;

        // do not close for the parent toggler link
        if (a.matches("[data-desktop-parent]")) return;

        // Desktop: don't auto-close; hover/focus handles dropdowns
        if (isDesktop()) return;

        // Mobile: leaf clicked → close drawer (submenu state already saved)
        closeNav();
    }); // NOTE: no capture here

    // close drawer when switching to desktop; also close click-open submenus
    const mq = window.matchMedia("(min-width: 960px)");
    mq.addEventListener?.("change", () => {
        closeNav();
        closeAllSubmenus();
    });

    // Route change (SPA): close the drawer; submenu state remains persisted via localStorage
    window.addEventListener("popstate", () => {
        closeNav();
    });

    // Initial restore of open panels
    restoreOpenPanels();
})();