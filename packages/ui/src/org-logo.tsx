export function OrgLogo({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.jpg"
      alt="Basirhat Ganapati Utsab Committee"
      width={size}
      height={size}
      className={["shrink-0 rounded-full bg-cream-50 object-cover shadow-sm ring-1 ring-cream-200/20", className]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
    />
  );
}
