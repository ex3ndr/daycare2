import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error" | "warning";

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
};

export type ToastStore = {
  toasts: Toast[];
  toastAdd: (message: string, variant?: ToastVariant) => void;
  toastDismiss: (id: string) => void;
};

let nextId = 0;

export const toastStoreCreate = () =>
  create<ToastStore>((set) => ({
    toasts: [],

    toastAdd: (message, variant = "default") => {
      const id = String(++nextId);
      const toast: Toast = { id, message, variant, createdAt: Date.now() };
      set((s) => ({ toasts: [...s.toasts, toast] }));

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 5000);
    },

    toastDismiss: (id) =>
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  }));
