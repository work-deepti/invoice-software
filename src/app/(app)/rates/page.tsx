import type { Metadata } from "next";
import { RateMaster } from "./rate-master";

export const metadata: Metadata = { title: "Rate master" };

export default function RatesPage() {
  return <RateMaster />;
}
