import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Two-segment "+text + icon" CTA used in the navbar, /why hero, etc.
// Polymorphic: pass `href` to render an `<a>` via next/link, or omit it to
// render a `<button type="button">` (useful for placeholders, modal
// triggers, or in-page actions that don't navigate).

type CommonProps = {
  children: ReactNode;
  icon?: ReactNode;
  size?: "sm" | "lg";
  // Optional color modifier. Default = primary blue (the original look).
  // "green" maps to .bubble-btn--green in globals.css.
  tone?: "blue" | "green";
};

type LinkVariantProps = CommonProps &
  Omit<ComponentProps<typeof Link>, "children">;

type ButtonVariantProps = CommonProps &
  Omit<ComponentProps<"button">, "children"> & {
    href?: never;
  };

type BubbleButtonProps = LinkVariantProps | ButtonVariantProps;

export function BubbleButton(props: BubbleButtonProps) {
  const { children, icon = "+", size = "sm", tone = "blue", ...rest } = props;
  const className = [
    "bubble-btn",
    size === "lg" ? "bubble-btn--lg" : "",
    tone === "green" ? "bubble-btn--green" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const inner = (
    <>
      <span className="bubble-btn__text">{children}</span>
      <span className="bubble-btn__icon" aria-hidden="true">
        {icon}
      </span>
    </>
  );

  if ("href" in rest && rest.href !== undefined) {
    return (
      <Link {...(rest as ComponentProps<typeof Link>)} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      {...(rest as ComponentProps<"button">)}
      className={className}
    >
      {inner}
    </button>
  );
}
