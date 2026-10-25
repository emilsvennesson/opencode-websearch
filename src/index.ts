import { Plugin } from "@opencode/plugin";

import { dispatchSearch } from "./providers/index.js";
import { resolveSearchRoute } from "./config.js";

// ── Constants ──────────────────────────────────────────────────────────

const PLUGIN_ID = "opencode-websearch";
const PROVIDER_ID = "native";
const PROVIDER_NAME = "Model-native search";

// ── Plugin ─────────────────────────────────────────────────────────────

// oxlint-disable-next-line import/no-default-export -- plugin entry point requires default export
export default Plugin.define({
  id: PLUGIN_ID,
  async setup(ctx) {
    await ctx.websearch.transform((editor) => {
      editor.add({
        execute: async ({ query }, { signal }) => {
          const route = await resolveSearchRoute(ctx);
          return dispatchSearch(
            route.resolution.type,
            {
              ...route.resolution.credentials,
              model: route.modelID,
              modelBaseURL: route.modelBaseURL,
              providerHeaders: route.resolution.headers,
            },
            query,
            signal,
          );
        },
        id: PROVIDER_ID,
        name: PROVIDER_NAME,
      });

      if (editor.default.get() === undefined) {
        editor.default.set(PROVIDER_ID);
      }
    });
  },
});
