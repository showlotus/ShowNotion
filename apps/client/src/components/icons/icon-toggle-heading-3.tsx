import { rem } from "@mantine/core";

type Props = {
  size?: number | string;
  stroke?: number;
};

export function IconToggleHeading3({ size = 24, stroke = 2 }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={rem(size)}
      height={rem(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Same caret as the toggle block arrow (details.css), rotated to point right */}
      <path
        d="M2.835 3.25a.8.8 0 0 0-.69 1.203l5.164 8.854a.8.8 0 0 0 1.382 0l5.165-8.854a.8.8 0 0 0-.691-1.203z"
        transform="translate(-0.95 15.52) scale(0.44) rotate(-90)"
        fill="currentColor"
        stroke="none"
      />
      <g transform="translate(4.21 1.92) scale(0.84)" strokeWidth={stroke / 0.84}>
        <path d="M19 14a2 2 0 1 0 -2 -2" />
        <path d="M17 16a2 2 0 1 0 2 -2" />
        <path d="M4 6v12" />
        <path d="M12 6v12" />
        <path d="M11 18h2" />
        <path d="M3 18h2" />
        <path d="M4 12h8" />
        <path d="M3 6h2" />
        <path d="M11 6h2" />
      </g>
    </svg>
  );
}
