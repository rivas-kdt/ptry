import { AppHeader } from "@/components/app-header/app-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
