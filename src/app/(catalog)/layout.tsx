import { AppFrame } from "@/components/app-frame";

export default function CatalogLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppFrame showNav signedIn={false} scope="Hearthline Instruments · Demo" note="Knowledge catalog">
      {children}
    </AppFrame>
  );
}
