"use client";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "@/lib/auth";

type Props = { roles?: Array<"admin" | "bar_user" | "bartender">; children: ReactNode };

export default function Guard({ roles, children }: Props) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    const allowed = !roles || !!(user && roles.includes(user.role));

    if (!token || !user) {
      router.replace("/login");
      return;
    }

    if (!allowed) {
      if (user.role === "bartender") router.replace("/bartender");
      else router.replace("/dashboard");
      return;
    }

    setOk(true);
  }, [router, roles]);

  if (!ok) return null;
  return <>{children}</>;
}