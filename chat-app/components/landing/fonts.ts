import { Instrument_Serif } from "next/font/google";

/** Editorial display face for headlines; body copy stays in Geist. */
export const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
