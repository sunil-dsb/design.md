import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type BubbleButtonProps = Omit<ComponentProps<typeof Link>, "children"> & {
  children: ReactNode;
  icon?: ReactNode;
  size?: "sm" | "lg";
};

export function BubbleButton({
  children,
  icon = "+",
  size = "sm",
  ...props
}: BubbleButtonProps) {
  const className = size === "lg" ? "bubble-btn bubble-btn--lg" : "bubble-btn";
  return (
    <Link {...props} className={className}>
      <span className="bubble-btn__text">{children}</span>
      <span className="bubble-btn__icon" aria-hidden="true">
        {icon}
      </span>
    </Link>
  );
}
