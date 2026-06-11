export interface WholeFoodItem {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fibrePer100g: number;
}

export const WHOLE_FOODS: WholeFoodItem[] = [
  { name: "Chicken Breast", caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, fibrePer100g: 0 },
  { name: "Chicken Thigh", caloriesPer100g: 209, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 11, fibrePer100g: 0 },
  { name: "Turkey Breast", caloriesPer100g: 135, proteinPer100g: 30, carbsPer100g: 0, fatPer100g: 1, fibrePer100g: 0 },
  { name: "Eggs", caloriesPer100g: 155, proteinPer100g: 12.6, carbsPer100g: 1.1, fatPer100g: 10.6, fibrePer100g: 0 },
  { name: "Egg Whites", caloriesPer100g: 52, proteinPer100g: 11, carbsPer100g: 0.7, fatPer100g: 0.2, fibrePer100g: 0 },
  { name: "Salmon", caloriesPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13, fibrePer100g: 0 },
  { name: "Tuna (canned)", caloriesPer100g: 116, proteinPer100g: 25.5, carbsPer100g: 0, fatPer100g: 0.8, fibrePer100g: 0 },
  { name: "Beef Mince (lean)", caloriesPer100g: 215, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 12, fibrePer100g: 0 },
  { name: "Steak (sirloin)", caloriesPer100g: 207, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 11, fibrePer100g: 0 },
  { name: "Oats", caloriesPer100g: 389, proteinPer100g: 16.9, carbsPer100g: 66.3, fatPer100g: 6.9, fibrePer100g: 10.6 },
  { name: "Brown Rice (cooked)", caloriesPer100g: 123, proteinPer100g: 2.6, carbsPer100g: 25.6, fatPer100g: 1, fibrePer100g: 1.8 },
  { name: "White Rice (cooked)", caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28.2, fatPer100g: 0.3, fibrePer100g: 0.4 },
  { name: "Pasta (cooked)", caloriesPer100g: 158, proteinPer100g: 5.8, carbsPer100g: 31, fatPer100g: 0.9, fibrePer100g: 1.8 },
  { name: "Bread (wholegrain)", caloriesPer100g: 247, proteinPer100g: 9, carbsPer100g: 41, fatPer100g: 3.5, fibrePer100g: 6 },
  { name: "Bread (white)", caloriesPer100g: 265, proteinPer100g: 9, carbsPer100g: 49, fatPer100g: 3.2, fibrePer100g: 2.7 },
  { name: "Sweet Potato (cooked)", caloriesPer100g: 86, proteinPer100g: 1.6, carbsPer100g: 20.1, fatPer100g: 0.1, fibrePer100g: 3 },
  { name: "Potato (boiled)", caloriesPer100g: 77, proteinPer100g: 2, carbsPer100g: 17, fatPer100g: 0.1, fibrePer100g: 1.8 },
  { name: "Broccoli", caloriesPer100g: 34, proteinPer100g: 2.8, carbsPer100g: 6.6, fatPer100g: 0.4, fibrePer100g: 2.6 },
  { name: "Spinach", caloriesPer100g: 23, proteinPer100g: 2.9, carbsPer100g: 3.6, fatPer100g: 0.4, fibrePer100g: 2.2 },
  { name: "Avocado", caloriesPer100g: 160, proteinPer100g: 2, carbsPer100g: 9, fatPer100g: 15, fibrePer100g: 7 },
  { name: "Banana", caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3, fibrePer100g: 2.6 },
  { name: "Apple", caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2, fibrePer100g: 2.4 },
  { name: "Blueberries", caloriesPer100g: 57, proteinPer100g: 0.7, carbsPer100g: 14.5, fatPer100g: 0.3, fibrePer100g: 2.4 },
  { name: "Greek Yoghurt", caloriesPer100g: 97, proteinPer100g: 9, carbsPer100g: 3.6, fatPer100g: 5, fibrePer100g: 0 },
  { name: "Cottage Cheese", caloriesPer100g: 98, proteinPer100g: 11, carbsPer100g: 3.4, fatPer100g: 4.3, fibrePer100g: 0 },
  { name: "Milk (whole)", caloriesPer100g: 61, proteinPer100g: 3.2, carbsPer100g: 4.8, fatPer100g: 3.3, fibrePer100g: 0 },
  { name: "Milk (semi-skimmed)", caloriesPer100g: 46, proteinPer100g: 3.4, carbsPer100g: 4.8, fatPer100g: 1.6, fibrePer100g: 0 },
  { name: "Almond Milk (unsweetened)", caloriesPer100g: 15, proteinPer100g: 0.5, carbsPer100g: 0.6, fatPer100g: 1.1, fibrePer100g: 0.2 },
  { name: "Almond Milk (sweetened)", caloriesPer100g: 24, proteinPer100g: 0.4, carbsPer100g: 3.5, fatPer100g: 1.0, fibrePer100g: 0.2 },
  { name: "Oat Milk", caloriesPer100g: 46, proteinPer100g: 1, carbsPer100g: 7.9, fatPer100g: 1.5, fibrePer100g: 0.8 },
  { name: "Almonds", caloriesPer100g: 579, proteinPer100g: 21, carbsPer100g: 22, fatPer100g: 50, fibrePer100g: 12.5 },
  { name: "Peanut Butter", caloriesPer100g: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50, fibrePer100g: 6 },
  { name: "Olive Oil", caloriesPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100, fibrePer100g: 0 },
  { name: "Whey Protein", caloriesPer100g: 380, proteinPer100g: 75, carbsPer100g: 8, fatPer100g: 5, fibrePer100g: 0 },
  { name: "Kidney Beans (cooked)", caloriesPer100g: 127, proteinPer100g: 8.7, carbsPer100g: 22.8, fatPer100g: 0.5, fibrePer100g: 6.4 },
  { name: "Lentils (cooked)", caloriesPer100g: 116, proteinPer100g: 9, carbsPer100g: 20, fatPer100g: 0.4, fibrePer100g: 7.9 },
  { name: "Baked Beans (canned)", caloriesPer100g: 94, proteinPer100g: 5, carbsPer100g: 14.5, fatPer100g: 0.5, fibrePer100g: 3.7 },
  { name: "Butter", caloriesPer100g: 717, proteinPer100g: 0.9, carbsPer100g: 0.1, fatPer100g: 81, fibrePer100g: 0 },
  { name: "Honey", caloriesPer100g: 304, proteinPer100g: 0.3, carbsPer100g: 82.4, fatPer100g: 0, fibrePer100g: 0.2 },
];
