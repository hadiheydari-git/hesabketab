// Current-user preferences (display unit, theme) shared via React Query.
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export type Me = {
  id: string;
  name: string;
  username: string | null;
  displayUsername: string | null;
  displayUnit: "toman" | "rial";
  theme: "light" | "dark";
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ me: Me }>("/api/me"),
    staleTime: 60_000,
  });
}
