import { signal } from "@preact/signals";

// Set by a banner tap, read once by the screen it opens: which test, lecture or
// study material to bring forward. Screens clear it as soon as they use it.
export type FocusTarget = { type: "test" | "lecture" | "material"; id: string };
export const focusTarget = signal<FocusTarget | null>(null);
