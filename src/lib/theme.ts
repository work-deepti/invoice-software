/* Light / Dark / Match device. The choice lives in this browser only (localStorage);
   html[data-theme] always holds the resolved "light" | "dark". */
export type ThemeChoice = "light" | "dark" | "system";
export const THEME_KEY = "gsb-theme";
export const THEME_COLOR = { light: "#f6f5f2", dark: "#131216" } as const;

/** Runs in <head> before first paint, so there is no flash of the wrong theme. It also follows the device while
    the choice is Auto, and other open tabs when the choice changes. Keep it tiny and dependency-free. */
export const THEME_BOOT_SCRIPT = `(function(){var k="${THEME_KEY}",m=matchMedia("(prefers-color-scheme: dark)");function s(){var c="system";try{c=localStorage.getItem(k)||"system"}catch(e){}document.documentElement.dataset.theme=c==="dark"||(c==="system"&&m.matches)?"dark":"light"}s();m.addEventListener("change",s);addEventListener("storage",function(e){if(e.key===k)s()})})()`;

export function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolve(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice;
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* private mode: still apply for this page */
  }
  const t = resolve(choice);
  document.documentElement.dataset.theme = t;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLOR[t]));
}
