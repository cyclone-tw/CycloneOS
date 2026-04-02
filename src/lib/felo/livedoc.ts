// src/lib/felo/livedoc.ts

import { feloFetch } from "./client";
import type {
  FeloLiveDoc,
  FeloLiveDocListResponse,
  FeloLiveDocCreateResponse,
} from "./types";

export const feloLiveDoc = {
  async list(): Promise<FeloLiveDoc[]> {
    const res = await feloFetch<FeloLiveDocListResponse>("/v2/livedocs", {
      method: "GET",
    });
    return res.data?.items || [];
  },

  async create(name: string, description?: string): Promise<FeloLiveDoc> {
    const res = await feloFetch<FeloLiveDocCreateResponse>("/v2/livedocs", {
      body: { name, description: description || "" },
    });
    return res.data;
  },

  async delete(shortId: string): Promise<void> {
    await feloFetch(`/v2/livedocs/${shortId}`, { method: "DELETE" });
  },

  async getOrCreate(name = "CycloneOS Workspace"): Promise<FeloLiveDoc> {
    const items = await this.list();
    if (items.length > 0) return items[0];
    return this.create(name);
  },
};
