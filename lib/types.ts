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
  pitchId: number;
  teamId: number;
  type: BookingType;
  title: string | null;
  date: string; // YYYY-MM-DD
  startMin: number; // minutes from midnight
  endMin: number;
  bookedBy: string;
  createdAt: string;
}

export interface BookingWithNames extends Booking {
  pitchName: string;
  teamName: string;
  teamColour: string;
}

export interface ClashError {
  error: "clash";
  clashes: BookingWithNames[];
}
