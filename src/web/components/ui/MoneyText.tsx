// Amount display bound to the user's display-unit preference (Toman
// default): stored Rial is divided by 10 for display. Sign/label rules
// per brief §4.5: income positive, expense negative, balances neutral.
import { Money } from "@kashi-ui/react";
import { useMe } from "../../lib/me";
import type { DisplayUnit } from "../../../shared/domain/money";

type Tone = "neutral" | "positive" | "negative";

export function MoneyText({
  rial,
  tone = "neutral",
  size,
}: {
  rial: number;
  tone?: Tone;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const { data } = useMe();
  const unit: DisplayUnit = data?.me.displayUnit === "rial" ? "rial" : "toman";
  // Input is always stored Rial; Kashi converts rial → the display unit.
  return (
    <Money
      value={rial}
      from="rial"
      unit={unit === "toman" ? "toman" : "rial"}
      signed={tone !== "neutral"}
      size={size}
      style={
        tone === "positive"
          ? { color: "var(--k-color-success, #157f3d)" }
          : tone === "negative"
            ? { color: "var(--k-color-danger, #c62f2f)" }
            : undefined
      }
    />
  );
}
