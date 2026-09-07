import { readBootConfig } from "./config.js";
import { boot } from "./runtime/bootloader.js";

// document.currentScript only resolves correctly while this script is
// synchronously executing (not after DOMContentLoaded), so it's captured here.
const bootScript = document.currentScript;
const config = readBootConfig(bootScript);

document.addEventListener("DOMContentLoaded", () => {
    boot(config).catch((e) => console.error("[Reactopus] Fatal boot error:", e));
});
