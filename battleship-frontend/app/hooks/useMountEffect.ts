"use client";

import { useEffect } from "react";

export function useMountEffect(effect: () => void | (() => void)) {
  // Intentional external sync escape hatch; see no-use-effect skill.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
