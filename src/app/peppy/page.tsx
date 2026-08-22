import type { Metadata } from "next";
import { PeppyFoundation } from "../_components/peppy-foundation";

export const metadata: Metadata = {
  title: { absolute: "Peppy · daily life, made easier" },
  description: "A calm, accessible assistant that helps with the next useful thing.",
};

export default function PeppyPage() {
  return <PeppyFoundation />;
}