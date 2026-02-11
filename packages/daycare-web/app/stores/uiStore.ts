import { create } from "zustand";

export type ModalType =
  | "createOrg"
  | "createChannel"
  | "channelSettings"
  | "userProfile";

export type UiStore = {
  sidebarCollapsed: boolean;
  composerDrafts: Record<string, string>;
  threadComposerDraft: string;
  threadComposerDrafts: Record<string, string>;
  activeModal: ModalType | null;
  searchOpen: boolean;
  searchQuery: string;

  sidebarToggle: () => void;
  composerDraftSet: (channelId: string, text: string) => void;
  threadComposerDraftSet: (threadId: string, text: string) => void;
  modalOpen: (modal: ModalType) => void;
  modalClose: () => void;
  searchToggle: () => void;
  searchQuerySet: (query: string) => void;
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

    searchQuerySet: (query) => set({ searchQuery: query }),
  }));
