import { Dimensions } from "react-native";

const BASE_WIDTH = 390;

export function screenScale(): number {
  return Math.min(Dimensions.get("window").width / BASE_WIDTH, 1);
}

export function rs(size: number, factor = 1): number {
  return Math.round(size * factor * screenScale());
}
