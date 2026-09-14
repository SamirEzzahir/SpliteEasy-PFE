import Image from "next/image";

export default function BrandLogo() {
  return <Image src="/branding/logo.png" alt="SplitEasy" width={1448} height={1086}
    className="app-brand-logo" sizes="200px" priority />;
}
