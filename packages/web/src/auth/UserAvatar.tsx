import { type Session } from "@/auth/auth-client";
import { cn } from "@/util/cn";

export function UserAvatar({
  user,
  className = "w-6 h-6 text-xs",
}: {
  user: Session["user"];
  className?: string;
}) {
  if (user.image) {
    return (
      <img
        src={user.image}
        alt={user.name ?? ""}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-gray-300 font-medium text-gray-600",
        className,
      )}>
      {user.name?.[0]?.toUpperCase()}
    </div>
  );
}
