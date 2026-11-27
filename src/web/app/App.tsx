import { useEffect, useState } from "react";
import { APP_TITLE } from "../../shared/constants";

// Stage 0 skeleton page: proves the SPA + Worker + D1 pipeline end to end.
// The real RTL shell, Kashi components and fonts arrive in Stages 1–2.
export function App() {
  const [state, setState] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? Promise.resolve(res) : Promise.reject(new Error(String(res.status)))))
      .then(() => setState("ok"))
      .catch(() => setState("down"));
  }, []);

  return (
    <main className="hello">
      <h1>{APP_TITLE}</h1>
      <p>اسکلت اولیه راه‌اندازی شد.</p>
      <p className="status" role="status">
        {state === "checking" && "در حال بررسی وضعیت…"}
        {state === "ok" && "وضعیت سامانه: متصل"}
        {state === "down" && "وضعیت سامانه: قطع"}
      </p>
    </main>
  );
}
