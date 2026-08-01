import { Outlet } from "react-router-dom";
import { SiteFooter } from "../components/SiteFooter";

export function FooterOnlyLayout() {
  return (
    <div className="footer-only-shell">
      <Outlet />
      <SiteFooter />
    </div>
  );
}
