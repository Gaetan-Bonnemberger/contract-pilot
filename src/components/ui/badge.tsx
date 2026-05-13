import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "destructive";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-blue-600 text-white",
        variant === "secondary" && "bg-gray-100 text-gray-700",
        variant === "outline" && "border border-gray-300 text-gray-600 bg-white",
        variant === "destructive" && "bg-red-100 text-red-800",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
