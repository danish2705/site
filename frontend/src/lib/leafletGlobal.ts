// leaflet.markercluster's UMD build (dist/leaflet.markercluster-src.js) does not
// import/require Leaflet — it references a bare global `L` and expects it to
// already exist on `window` (the old "load Leaflet via <script> tag" model).
//
// In dev, Vite's esbuild dep pre-bundler happens to resolve "leaflet" through
// its CJS build, which has a `window.L = exports` side effect, so `L` exists
// by the time the markercluster chunk runs. Vite's production build (Rolldown)
// bundles/orders things differently and that incidental side effect doesn't
// reliably survive, so `L.markerClusterGroup` is undefined at runtime and you
// get "Gt.markerClusterGroup is not a function" only in production.
//
// Fix: explicitly set window.L from a module that fully finishes evaluating
// (including this assignment) before "leaflet.markercluster" is imported.
// ES module import statements execute in declaration order, each one's whole
// subtree first, so importing this file *before* "leaflet.markercluster"
// guarantees the global is present regardless of bundler/mode.
import * as L from "leaflet";

if (typeof window !== "undefined") {
  (window as unknown as { L: typeof L }).L = L;
}

export default L;
