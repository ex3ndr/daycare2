import { describe, it, expect, beforeEach } from "vitest";
import { uiStoreCreate } from "./uiStore";
import type { UiStore } from "./uiStore";
import type { StoreApi } from "zustand";

describe("uiStore", () => {
  let store: StoreApi<UiStore>;

  beforeEach(() => {
    store = uiStoreCreate();
  });

  describe("sidebarToggle", () => {
    it("toggles sidebarCollapsed from false to true", () => {
      expect(store.getState().sidebarCollapsed).toBe(false);
      store.getState().sidebarToggle();
      expect(store.getState().sidebarCollapsed).toBe(true);
    });

    it("toggles sidebarCollapsed back to false", () => {
      store.getState().sidebarToggle();
      store.getState().sidebarToggle();
      expect(store.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe("composerDraftSet", () => {
    it("sets a draft for a channel", () => {
      store.getState().composerDraftSet("ch1", "hello world");
      expect(store.getState().composerDrafts["ch1"]).toBe("hello world");
    });

    it("sets drafts for multiple channels independently", () => {
      store.getState().composerDraftSet("ch1", "draft one");
      store.getState().composerDraftSet("ch2", "draft two");
      expect(store.getState().composerDrafts["ch1"]).toBe("draft one");
      expect(store.getState().composerDrafts["ch2"]).toBe("draft two");
    });

    it("overwrites existing draft for same channel", () => {
      store.getState().composerDraftSet("ch1", "first");
      store.getState().composerDraftSet("ch1", "second");
      expect(store.getState().composerDrafts["ch1"]).toBe("second");
    });

    it("can clear a draft by setting empty string", () => {
      store.getState().composerDraftSet("ch1", "hello");
      store.getState().composerDraftSet("ch1", "");
      expect(store.getState().composerDrafts["ch1"]).toBe("");
    });
  });

  describe("modalOpen / modalClose", () => {
    it("starts with no active modal", () => {
      expect(store.getState().activeModal).toBe(null);
    });

    it("opens a modal", () => {
      store.getState().modalOpen("createChannel");
      expect(store.getState().activeModal).toBe("createChannel");
    });

    it("switches to a different modal", () => {
      store.getState().modalOpen("createChannel");
      store.getState().modalOpen("userProfile");
      expect(store.getState().activeModal).toBe("userProfile");
    });

    it("closes the active modal", () => {
      store.getState().modalOpen("createOrg");
      store.getState().modalClose();
      expect(store.getState().activeModal).toBe(null);
    });

    it("closing when no modal is open is a no-op", () => {
      store.getState().modalClose();
      expect(store.getState().activeModal).toBe(null);
    });
  });

  describe("searchToggle", () => {
    it("opens search", () => {
      store.getState().searchToggle();
      expect(store.getState().searchOpen).toBe(true);
    });

    it("closes search and clears query", () => {
      store.getState().searchToggle();
      store.getState().searchQuerySet("test query");
      store.getState().searchToggle();
      expect(store.getState().searchOpen).toBe(false);
      expect(store.getState().searchQuery).toBe("");
    });
  });

  describe("searchQuerySet", () => {
    it("sets the search query", () => {
      store.getState().searchQuerySet("find messages");
      expect(store.getState().searchQuery).toBe("find messages");
    });

    it("can clear the search query", () => {
      store.getState().searchQuerySet("something");
      store.getState().searchQuerySet("");
      expect(store.getState().searchQuery).toBe("");
    });
  });

  describe("threadComposerDraft", () => {
    it("starts as empty string", () => {
      expect(store.getState().threadComposerDraft).toBe("");
    });
  });

  describe("initial state", () => {
    it("has correct defaults", () => {
      const state = store.getState();
      expect(state.sidebarCollapsed).toBe(false);
      expect(state.composerDrafts).toEqual({});
      expect(state.threadComposerDraft).toBe("");
      expect(state.activeModal).toBe(null);
      expect(state.searchOpen).toBe(false);
      expect(state.searchQuery).toBe("");
    });
  });
});
