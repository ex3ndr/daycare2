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

  describe("threadComposerDraftSet", () => {
    it("sets a draft for a thread", () => {
      store.getState().threadComposerDraftSet("thread-1", "reply text");
      expect(store.getState().threadComposerDrafts["thread-1"]).toBe("reply text");
    });

    it("sets drafts for multiple threads independently", () => {
      store.getState().threadComposerDraftSet("thread-1", "reply one");
      store.getState().threadComposerDraftSet("thread-2", "reply two");
      expect(store.getState().threadComposerDrafts["thread-1"]).toBe("reply one");
      expect(store.getState().threadComposerDrafts["thread-2"]).toBe("reply two");
    });

    it("overwrites existing draft for same thread", () => {
      store.getState().threadComposerDraftSet("thread-1", "first");
      store.getState().threadComposerDraftSet("thread-1", "second");
      expect(store.getState().threadComposerDrafts["thread-1"]).toBe("second");
    });

    it("can clear a draft by setting empty string", () => {
      store.getState().threadComposerDraftSet("thread-1", "hello");
      store.getState().threadComposerDraftSet("thread-1", "");
      expect(store.getState().threadComposerDrafts["thread-1"]).toBe("");
    });
  });

  describe("photoViewer", () => {
    const images = [
      { url: "/img/a.png", fileName: "a.png" },
      { url: "/img/b.png", fileName: "b.png" },
      { url: "/img/c.png", fileName: null },
    ];

    it("starts as null", () => {
      expect(store.getState().photoViewer).toBe(null);
    });

    it("opens with images and start index", () => {
      store.getState().photoViewerOpen(images, 1);
      const pv = store.getState().photoViewer;
      expect(pv).not.toBe(null);
      expect(pv!.images).toEqual(images);
      expect(pv!.currentIndex).toBe(1);
    });

    it("closes and resets to null", () => {
      store.getState().photoViewerOpen(images, 0);
      store.getState().photoViewerClose();
      expect(store.getState().photoViewer).toBe(null);
    });

    it("navigates to next image with wraparound", () => {
      store.getState().photoViewerOpen(images, 1);
      store.getState().photoViewerNext();
      expect(store.getState().photoViewer!.currentIndex).toBe(2);
      store.getState().photoViewerNext();
      expect(store.getState().photoViewer!.currentIndex).toBe(0);
    });

    it("navigates to previous image with wraparound", () => {
      store.getState().photoViewerOpen(images, 0);
      store.getState().photoViewerPrev();
      expect(store.getState().photoViewer!.currentIndex).toBe(2);
      store.getState().photoViewerPrev();
      expect(store.getState().photoViewer!.currentIndex).toBe(1);
    });

    it("next is a no-op when viewer is closed", () => {
      store.getState().photoViewerNext();
      expect(store.getState().photoViewer).toBe(null);
    });

    it("prev is a no-op when viewer is closed", () => {
      store.getState().photoViewerPrev();
      expect(store.getState().photoViewer).toBe(null);
    });
  });

  describe("failedMessageAdd", () => {
    it("adds a failed message", () => {
      store.getState().failedMessageAdd("fail-1", {
        chatId: "ch-1",
        text: "Hello",
        threadId: null,
        attachments: [],
        failedAt: 1000,
        error: "Network error",
      });
      expect(store.getState().failedMessages["fail-1"]).toEqual({
        chatId: "ch-1",
        text: "Hello",
        threadId: null,
        attachments: [],
        failedAt: 1000,
        error: "Network error",
      });
    });

    it("adds multiple failed messages independently", () => {
      store.getState().failedMessageAdd("fail-1", {
        chatId: "ch-1",
        text: "First",
        threadId: null,
        attachments: [],
        failedAt: 1000,
        error: "Error 1",
      });
      store.getState().failedMessageAdd("fail-2", {
        chatId: "ch-2",
        text: "Second",
        threadId: "thread-1",
        attachments: [{ kind: "file", url: "https://example.com/f.txt" }],
        failedAt: 2000,
        error: "Error 2",
      });
      expect(Object.keys(store.getState().failedMessages)).toHaveLength(2);
      expect(store.getState().failedMessages["fail-1"].text).toBe("First");
      expect(store.getState().failedMessages["fail-2"].text).toBe("Second");
    });
  });

  describe("failedMessageRemove", () => {
    it("removes a failed message", () => {
      store.getState().failedMessageAdd("fail-1", {
        chatId: "ch-1",
        text: "Hello",
        threadId: null,
        attachments: [],
        failedAt: 1000,
        error: "Network error",
      });
      store.getState().failedMessageRemove("fail-1");
      expect(store.getState().failedMessages["fail-1"]).toBeUndefined();
      expect(Object.keys(store.getState().failedMessages)).toHaveLength(0);
    });

    it("only removes the specified message", () => {
      store.getState().failedMessageAdd("fail-1", {
        chatId: "ch-1",
        text: "First",
        threadId: null,
        attachments: [],
        failedAt: 1000,
        error: "Error 1",
      });
      store.getState().failedMessageAdd("fail-2", {
        chatId: "ch-1",
        text: "Second",
        threadId: null,
        attachments: [],
        failedAt: 2000,
        error: "Error 2",
      });
      store.getState().failedMessageRemove("fail-1");
      expect(store.getState().failedMessages["fail-1"]).toBeUndefined();
      expect(store.getState().failedMessages["fail-2"].text).toBe("Second");
    });

    it("is a no-op for non-existent id", () => {
      store.getState().failedMessageRemove("nonexistent");
      expect(Object.keys(store.getState().failedMessages)).toHaveLength(0);
    });
  });

  describe("initial state", () => {
    it("has correct defaults", () => {
      const state = store.getState();
      expect(state.sidebarCollapsed).toBe(false);
      expect(state.composerDrafts).toEqual({});
      expect(state.threadComposerDraft).toBe("");
      expect(state.threadComposerDrafts).toEqual({});
      expect(state.activeModal).toBe(null);
      expect(state.searchOpen).toBe(false);
      expect(state.searchQuery).toBe("");
      expect(state.photoViewer).toBe(null);
      expect(state.failedMessages).toEqual({});
    });
  });
});
