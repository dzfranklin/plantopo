import logoPath from "./os_logo.svg";

// Based on <https://github.com/OrdnanceSurvey/os-api-branding>.

export const osBrandStatement = `Contains OS data &copy; Crown copyright and database rights ${new Date().getFullYear()}`;

export function OSBrandLogo() {
  return (
    <img
      src={logoPath}
      alt="Ordnance Survey"
      className="pointer-events-none absolute bottom-0 left-0 z-50 m-[8px] h-[24px] w-[90px]"
    />
  );
}
