export function Logo({ width = 200, start }: { width?: number; start?: boolean }) {
  return (
    <img
      class={start ? "logo start" : "logo"}
      src="/logo.webp"
      width={640}
      height={532}
      alt="উত্তরপত্র Coaching Institute"
      style={`--logo-w:${width}px`}
    />
  );
}
