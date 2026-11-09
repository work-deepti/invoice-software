import type { Metadata } from "next";
import { ShopSettings } from "./shop-settings";

export const metadata: Metadata = { title: "Shop settings" };

export default function SettingsPage() {
  return <ShopSettings />;
}
