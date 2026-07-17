export type BookingType = "fixture" | "training";

export interface Pitch {
  id: number;
  name: string;
}

export interface Team {
  id: number;
  name: string;
  colour: string;
}

export interface Booking {
  id: number;
  /** null = no pitch required (training or away/off-site) — never clashes */
  pitchId: number | null;
  teamId: number;
  type: BookingType;
  title: string | null;
  date: string; // YYYY-MM-DD
  startMin: number; // minutes from midnight
  endMin: number;
  bookedBy: string;
  createdAt: string;
  /** Set for externally-synced bookings, e.g. "fulltime:<fixtureId>" */
  sourceRef: string | null;
}

export interface BookingWithNames extends Booking {
  pitchName: string | null;
  teamName: string;
  teamColour: string;
}

export interface ClashError {
  error: "clash";
  clashes: BookingWithNames[];
}
