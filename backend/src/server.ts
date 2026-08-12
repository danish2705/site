import { createApp } from "./app.js";
import { config } from "./config.js";
import { loadStore } from "./repository/excelStore.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);

  // Warm the Excel store at boot so a bad dataset is reported here rather
  // than on the first request — but don't let it stop the server starting.
  try {
    const store = loadStore();
    console.log(
      `Loaded ${store.sites.length} sites, ${store.risks.length} risk records from ${store.filePath}`,
    );
  } catch (err) {
    console.error(
      "WARNING: failed to load Excel data at startup:",
      (err as Error).message,
    );
  }
});
