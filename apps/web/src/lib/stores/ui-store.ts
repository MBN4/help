import { create } from 'zustand';

interface UIState {
  mobileNavOpen: boolean;
  filterSheetOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  setFilterSheetOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mobileNavOpen: false,
  filterSheetOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setFilterSheetOpen: (open) => set({ filterSheetOpen: open }),
}));
