import { useEffect } from "react";

export default function ScrollbarVisibility() {
    useEffect(() => {
        const timers = new Map();
        const handleScroll = (event) => {
            const target = event.target?.nodeType === 9
                ? document.documentElement
                : event.target?.nodeType === 1
                    ? event.target
                    : null;
            if (!target?.classList) return;

            const existingTimers = timers.get(target);
            if (existingTimers) {
                window.clearTimeout(existingTimers.fade);
                window.clearTimeout(existingTimers.hide);
            }

            target.classList.add("cs-is-scrolling");
            target.classList.remove("cs-scrollbar-fading");
            const fade = window.setTimeout(() => target.classList.add("cs-scrollbar-fading"), 650);
            const hide = window.setTimeout(() => {
                target.classList.remove("cs-is-scrolling", "cs-scrollbar-fading");
                timers.delete(target);
            }, 900);
            timers.set(target, { fade, hide });
        };

        document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
        return () => {
            document.removeEventListener("scroll", handleScroll, true);
            timers.forEach(({ fade, hide }, target) => {
                window.clearTimeout(fade);
                window.clearTimeout(hide);
                target.classList.remove("cs-is-scrolling", "cs-scrollbar-fading");
            });
        };
    }, []);

    return null;
}
