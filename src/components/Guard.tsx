"use client";
import { ReactNode, useEffect, useState } from "react";
import { getToken, getUser } from "@/lib/auth";

type Props = { roles?: Array<"admin"|"bar_user"|"bartender">; children: ReactNode };

export default function Guard({ roles, children }: Props) {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    const allowed = !roles || !!(user && roles.includes(user.role));
    setOk(!!token && allowed);
    if (!token) window.location.href = "/login";
    else if (!allowed) window.location.href = "/dashboard"; // o 403
  }, [roles]);

  if (!ok) return null;
  return <>{children}</>;
}
