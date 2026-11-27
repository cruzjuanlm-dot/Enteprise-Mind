import { AppFrame } from "@/components/app-frame";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppFrame showNav signedIn={false} scope="Hearthline Instruments · Admin" note={null}>
      {children}
    </AppFrame>
  );
}
