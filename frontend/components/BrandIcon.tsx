import Image from "next/image";

export default function BrandIcon({ size = 36 }: { size?: number }) {
  return <Image src="/branding/app-icon.png" alt="" width={size} height={size}
    className="app-brand-icon" sizes={`${size}px`} />;
}
