import type { ReactNode } from "react";
import "./globals.css";
import AuthGate from "../components/AuthGate";

export const metadata = {
  title: "Gym SaaS Admin",
  description: "Admin dashboard for gym management"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
