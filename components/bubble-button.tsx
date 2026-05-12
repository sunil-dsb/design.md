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
};

type LinkVariantProps = CommonProps &
  Omit<ComponentProps<typeof Link>, "children">;

type ButtonVariantProps = CommonProps &
  Omit<ComponentProps<"button">, "children"> & {
    href?: never;
  };

type BubbleButtonProps = LinkVariantProps | ButtonVariantProps;

export function BubbleButton(props: BubbleButtonProps) {
  const { children, icon = "+", size = "sm", ...rest } = props;
  const className =
    size === "lg" ? "bubble-btn bubble-btn--lg" : "bubble-btn";
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
