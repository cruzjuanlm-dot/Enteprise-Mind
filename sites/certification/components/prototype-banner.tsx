import { prototypeBanner } from "@/lib/site";

export function PrototypeBanner() {
  return (
    <div className="banner" role="note">
      <div className="frame banner-inner">
        <strong className="banner-label">Notice</strong>
        <span>{prototypeBanner}</span>
      </div>
    </div>
  );
}
