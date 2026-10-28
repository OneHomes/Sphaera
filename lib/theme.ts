// Light/dark theme constants, shared by the server root layout and the client ThemeToggle.
// The choice lives in localStorage and is applied as `html.light` before first paint.
export const THEME_STORAGE_KEY = "sphaera-theme";
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="light")document.documentElement.classList.add("light")}catch(e){}`;
