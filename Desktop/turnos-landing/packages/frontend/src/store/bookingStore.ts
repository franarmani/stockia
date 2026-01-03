import { create } from 'zustand';

export interface BookingStep {
  service?: {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
  };
  employee?: {
    id: string;
    name: string;
  };
  date?: string; // YYYY-MM-DD
  time?: string; // ISO 8601
  clientInfo?: {
    name: string;
    email: string;
    phone: string;
    notes?: string;
  };
  appointmentId?: string;
}

interface BookingStore {
  currentStep: number; // 0=service, 1=employee, 2=date, 3=time, 4=client, 5=confirmation
  bookingData: BookingStep;
  setStep: (step: number) => void;
  updateBookingData: (data: Partial<BookingStep>) => void;
  resetBooking: () => void;
}

export const useBookingStore = create<BookingStore>((set) => ({
  currentStep: 0,
  bookingData: {},
  setStep: (step: number) => set({ currentStep: step }),
  updateBookingData: (data: Partial<BookingStep>) =>
    set((state) => ({
      bookingData: { ...state.bookingData, ...data },
    })),
  resetBooking: () => set({ currentStep: 0, bookingData: {} }),
}));
