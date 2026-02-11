import { create } from "zustand";

export type ModalType =
  | "createOrg"
  | "createChannel"
  | "channelSettings"
  | "userProfile";

export type PhotoViewerImage = {
  url: string;
  fileName: string | null;
};

export type PhotoViewerState = {
  images: PhotoViewerImage[];
  currentIndex: number;
};

export type UiStore = {
  sidebarCollapsed: boolean;
  composerDrafts: Record<string, string>;
  threadComposerDraft: string;
  threadComposerDrafts: Record<string, string>;
  activeModal: ModalType | null;
  searchOpen: boolean;
  searchQuery: string;
  photoViewer: PhotoViewerState | null;

  sidebarToggle: () => void;
  composerDraftSet: (channelId: string, text: string) => void;
  threadComposerDraftSet: (threadId: string, text: string) => void;
  modalOpen: (modal: ModalType) => void;
  modalClose: () => void;
  searchToggle: () => void;
  searchClose: () => void;
  searchQuerySet: (query: string) => void;
  photoViewerOpen: (images: PhotoViewerImage[], startIndex: number) => void;
  photoViewerClose: () => void;
  photoViewerNext: () => void;
  photoViewerPrev: () => void;
};

export const uiStoreCreate = () =>
  create<UiStore>((set) => ({
    sidebarCollapsed: false,
    composerDrafts: {},
    threadComposerDraft: "",
    threadComposerDrafts: {},
    activeModal: null,
    searchOpen: false,
    searchQuery: "",
    photoViewer: null,

    sidebarToggle: () =>
      set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

    composerDraftSet: (channelId, text) =>
      set((s) => ({
        composerDrafts: { ...s.composerDrafts, [channelId]: text },
      })),

    threadComposerDraftSet: (threadId, text) =>
      set((s) => ({
        threadComposerDrafts: { ...s.threadComposerDrafts, [threadId]: text },
      })),

    modalOpen: (modal) => set({ activeModal: modal }),

    modalClose: () => set({ activeModal: null }),

    searchToggle: () =>
      set((s) => ({
        searchOpen: !s.searchOpen,
        searchQuery: s.searchOpen ? "" : s.searchQuery,
      })),

    searchClose: () =>
      set({ searchOpen: false, searchQuery: "" }),

    searchQuerySet: (query) => set({ searchQuery: query }),

    photoViewerOpen: (images, startIndex) => {
      if (images.length === 0) return;
      const clamped = Math.max(0, Math.min(startIndex, images.length - 1));
      set({ photoViewer: { images, currentIndex: clamped } });
    },

    photoViewerClose: () => set({ photoViewer: null }),

    photoViewerNext: () =>
      set((s) => {
        if (!s.photoViewer) return s;
        const next = (s.photoViewer.currentIndex + 1) % s.photoViewer.images.length;
        return { photoViewer: { ...s.photoViewer, currentIndex: next } };
      }),

    photoViewerPrev: () =>
      set((s) => {
        if (!s.photoViewer) return s;
        const len = s.photoViewer.images.length;
        const prev = (s.photoViewer.currentIndex - 1 + len) % len;
        return { photoViewer: { ...s.photoViewer, currentIndex: prev } };
      }),
  }));
