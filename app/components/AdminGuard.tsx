"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">(
    "loading"
  );

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.user && data.user.role === "admin") {
          setStatus("allowed");
        } else {
          setStatus("denied");
          router.push("/login");
        }
      })
      .catch(() => {
        setStatus("denied");
        router.push("/login");
      });
  }, [router]);

  if (status === "loading") {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <p>Проверка доступа...</p>
        </div>
      </div>
    );
  }

  if (status === "denied") return null;

  return <>{children}</>;
}