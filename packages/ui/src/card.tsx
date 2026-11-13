import type { ComponentProps } from "react";
import { cn } from "./utils";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("panel rounded-2xl", className)} {...props} />;
}
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center justify-between gap-3 p-6", className)} {...props} />
  );
}
export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-base font-medium tracking-tight text-slate-100", className)}
      {...props}
    />
  );
}
export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-6 pb-6", className)} {...props} />;
}
