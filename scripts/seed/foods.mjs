// Seed data: approximate nutrition for common Indian foods.
// Values are rounded ESTIMATES informed by published food-composition data
// (e.g. IFCT 2017, USDA FoodData Central) and typical home-cooking portions.
// They are NOT copied from, or a live connection to, any database, and are not
// laboratory-verified. Cooked dishes vary a lot with oil, salt and recipe.
//
// Fields: [name, aliases, category, diet, allergens, qty, unit, unitGrams, kcal, protein, carbs, fat, fiber, micros, rawGrams, pricePerKg]
// pricePerKg: rough INR per kg (or litre) of the as-purchased ingredient, or null.
// micros: only where a reasonable approximate value is known.

export const SOURCE =
  "NutriTrack approximate estimate (informed by IFCT 2017 / USDA references; not lab-verified)";
export const PRICE_SOURCE =
  "NutriTrack default rough estimate (prices vary by city, season and shop; edit for your region)";

const G = "gluten", D = "dairy", E = "egg", P = "peanut", N = "tree_nut", S = "soy", F = "fish";

export const FOODS = [
  // ---- breads and cereals
  ["Roti / chapati (plain)", ["chapati", "phulka", "roti", "fulka"], "cereal", "vegan", [G], 1, "piece", { piece: 1, plate: 120 }, 102, 3.3, 20.7, 0.5, 3.3, { iron_mg: 1.5 }, 30, 40],
  ["Roti with ghee (1 tsp)", ["ghee roti", "chapati with ghee"], "cereal", "vegetarian", [G, D], 1, "piece", { piece: 1 }, 147, 3.3, 20.7, 5.5, 3.3, { iron_mg: 1.5 }, 30, 40],
  ["Plain paratha", ["paratha"], "cereal", "vegan", [G], 1, "piece", { piece: 1 }, 190, 4.4, 27.6, 6.7, 4.4, { iron_mg: 2 }, 40, 40],
  ["Aloo paratha", ["potato paratha"], "mixed_dish", "vegan", [G], 1, "piece", { piece: 1 }, 260, 6, 40, 9, 4, {}, null, null],
  ["Thepla", ["methi thepla"], "cereal", "vegan", [G], 1, "piece", { piece: 1 }, 118, 3, 16, 4.5, 2.5, {}, null, null],
  ["Bajra roti", ["pearl millet roti", "bajre ki roti"], "cereal", "vegan", [], 1, "piece", { piece: 1 }, 150, 4.5, 29, 2.6, 3.4, { iron_mg: 3 }, 40, 45],
  ["Ragi roti", ["finger millet roti", "nachni roti"], "cereal", "vegan", [], 1, "piece", { piece: 1 }, 131, 2.9, 28.8, 0.6, 4.5, { calcium_mg: 140, iron_mg: 1.6 }, 40, 60],
  ["White bread slice", ["bread", "bread slice"], "cereal", "vegetarian", [G, D], 1, "slice", { slice: 1 }, 80, 2.5, 15, 1, 0.7, {}, 30, 125],
  ["Brown bread slice", ["whole wheat bread"], "cereal", "vegetarian", [G, D], 1, "slice", { slice: 1 }, 75, 3, 13.5, 1, 2, {}, 30, 140],
  ["Cooked white rice", ["rice", "steamed rice", "chawal"], "cereal", "vegan", [], 150, "g", { cup: 160, katori: 150, bowl: 200, plate: 250 }, 195, 4, 42, 0.5, 0.6, {}, 55, 55],
  ["Cooked brown rice", ["brown rice"], "cereal", "vegan", [], 150, "g", { cup: 160, katori: 150, bowl: 200, plate: 250 }, 165, 3.5, 34, 1.3, 2.5, {}, 55, 90],
  ["Jeera rice", ["cumin rice"], "mixed_dish", "vegetarian", [D], 150, "g", { cup: 160, katori: 150, bowl: 200, plate: 250 }, 230, 4, 40, 6, 1, {}, null, null],
  ["Khichdi (dal rice)", ["dal khichdi", "moong khichdi"], "mixed_dish", "vegan", [], 200, "g", { katori: 150, bowl: 250, plate: 300 }, 258, 9, 42, 6, 4, {}, null, null],
  ["Poha (cooked)", ["flattened rice", "kanda poha", "aval"], "mixed_dish", "vegan", [P], 150, "g", { katori: 120, cup: 150, plate: 200 }, 230, 4.5, 38, 7, 2.5, {}, 50, 60],
  ["Upma", ["rava upma", "suji upma"], "mixed_dish", "vegan", [G], 150, "g", { katori: 120, cup: 150, plate: 200 }, 220, 5, 33, 7.5, 2.5, {}, null, null],
  ["Rolled oats, cooked in water", ["oats", "oatmeal", "porridge"], "cereal", "vegan", [G], 240, "g", { cup: 240, bowl: 250 }, 152, 5.3, 27, 2.6, 4, {}, 40, 180],
  ["Idli", ["idly"], "mixed_dish", "vegan", [], 1, "piece", { piece: 1, plate: 3 }, 58, 2, 12, 0.3, 0.5, {}, null, null],
  ["Plain dosa", ["dosa", "sada dosa"], "mixed_dish", "vegan", [], 1, "piece", { piece: 1 }, 133, 3.2, 24, 2.7, 1, {}, null, null],
  ["Masala dosa", ["masala dosai"], "mixed_dish", "vegan", [], 1, "piece", { piece: 1 }, 336, 7, 50, 12, 4, {}, null, null],
  ["Medu vada", ["vada", "uzhunnu vada"], "snack", "vegan", [], 1, "piece", { piece: 1 }, 112, 3.5, 10, 6.5, 1.5, {}, null, null],
  ["Besan chilla", ["cheela", "besan cheela", "gram flour pancake"], "mixed_dish", "vegan", [], 1, "piece", { piece: 1 }, 145, 6.5, 15, 6, 2.5, {}, 30, 90],
  // ---- pulses and legumes
  ["Toor dal, cooked (plain)", ["arhar dal", "toor dal", "dal", "plain dal"], "pulse", "vegan", [], 150, "g", { katori: 150, cup: 200, bowl: 200, plate: 250 }, 146, 9, 22, 2.5, 4.5, { iron_mg: 1.7 }, 40, 165],
  ["Dal tadka", ["tadka dal", "dal fry", "dal with ghee"], "mixed_dish", "vegetarian", [D], 150, "g", { katori: 150, cup: 200, bowl: 200 }, 187, 9, 22, 7, 4.5, { iron_mg: 1.7 }, 40, 165],
  ["Moong dal, cooked", ["moong", "green gram dal", "yellow moong dal"], "pulse", "vegan", [], 150, "g", { katori: 150, cup: 200, bowl: 200 }, 135, 10, 21, 1.2, 4, { iron_mg: 1.5 }, 40, 125],
  ["Masoor dal, cooked", ["red lentil", "masoor"], "pulse", "vegan", [], 150, "g", { katori: 150, cup: 200, bowl: 200 }, 145, 10, 23, 1, 4, { iron_mg: 2 }, 40, 95],
  ["Chana dal, cooked", ["bengal gram dal"], "pulse", "vegan", [], 150, "g", { katori: 150, cup: 200, bowl: 200 }, 183, 11, 28, 3, 7, { iron_mg: 2.3 }, 45, 100],
  ["Rajma curry", ["rajma", "kidney bean curry"], "mixed_dish", "vegan", [], 150, "g", { katori: 150, cup: 200, bowl: 200 }, 198, 9, 27, 6, 8, { iron_mg: 2.2 }, 45, 150],
  ["Chole (chickpea curry)", ["chana masala", "chole", "chhole"], "mixed_dish", "vegan", [], 150, "g", { katori: 150, cup: 200, bowl: 200 }, 232, 10, 30, 8, 8, { iron_mg: 2.8 }, 45, 130],
  ["Boiled chickpeas / black chana", ["kala chana", "boiled chana", "sundal"], "pulse", "vegan", [], 100, "g", { katori: 100, cup: 160, bowl: 150 }, 164, 8.9, 27, 2.6, 7.6, { iron_mg: 2.9 }, 35, 95],
  ["Moong sprouts", ["sprouts", "sprouted moong"], "pulse", "vegan", [], 100, "g", { katori: 80, cup: 100, bowl: 120 }, 48, 4, 7.5, 0.4, 2, {}, 100, 100],
  ["Soya chunks (dry)", ["soy chunks", "meal maker", "nutrela", "soya nuggets"], "pulse", "vegan", [S], 30, "g", { katori: 30 }, 104, 15.6, 9.9, 0.2, 4, { iron_mg: 5 }, 30, 130],
  ["Soya chunks curry", ["soya curry", "meal maker curry"], "mixed_dish", "vegan", [S], 150, "g", { katori: 150, bowl: 200 }, 180, 13, 12, 8, 4, {}, null, null],
  ["Sambar", ["sambhar"], "mixed_dish", "vegan", [], 150, "g", { katori: 150, cup: 200, bowl: 200 }, 82, 4, 11, 2.5, 3, {}, null, null],
  ["Kadhi (besan curd curry)", ["punjabi kadhi", "kadhi pakora"], "mixed_dish", "vegetarian", [D], 150, "g", { katori: 150, cup: 200, bowl: 200 }, 132, 5, 10, 8, 1, {}, null, null],
  // ---- dairy and eggs
  ["Boiled egg", ["egg", "anda", "hard boiled egg"], "egg", "eggetarian", [E], 1, "piece", { piece: 1 }, 75, 6.3, 0.6, 5.3, 0, { iron_mg: 0.9, calcium_mg: 25, vitamin_b12_mcg: 0.5 }, 50, 140],
  ["Omelette (2 eggs, 1 tsp oil)", ["omelet", "masala omelette"], "egg", "eggetarian", [E], 1, "plate", { plate: 120, piece: 120 }, 198, 12.5, 2, 15.5, 0.3, { iron_mg: 1.8, calcium_mg: 50, vitamin_b12_mcg: 1 }, 100, null],
  ["Egg bhurji (2 eggs)", ["egg bhurji", "scrambled eggs", "anda bhurji"], "egg", "eggetarian", [E], 1, "plate", { plate: 130, piece: 130 }, 226, 13, 3, 18, 0.5, { iron_mg: 1.8, vitamin_b12_mcg: 1 }, 100, null],
  ["Toned milk (3% fat)", ["milk", "doodh", "toned milk"], "dairy", "vegetarian", [D], 240, "ml", { glass: 240, cup: 240, katori: 150 }, 140, 7.4, 11.3, 7.2, 0, { calcium_mg: 290, vitamin_b12_mcg: 1 }, 240, 56],
  ["Curd / dahi", ["dahi", "yogurt", "curd"], "dairy", "vegetarian", [D], 100, "g", { katori: 100, cup: 240, bowl: 200, tbsp: 15 }, 60, 3.1, 3, 4, 0, { calcium_mg: 120, vitamin_b12_mcg: 0.4 }, 100, 80],
  ["Buttermilk (chaas)", ["chaas", "chhaas", "mattha", "lassi plain"], "dairy", "vegetarian", [D], 240, "ml", { glass: 240, cup: 240 }, 35, 2, 3.2, 1.2, 0, { calcium_mg: 100 }, 80, 80],
  ["Paneer", ["cottage cheese"], "dairy", "vegetarian", [D], 50, "g", { piece: 25, katori: 100, cup: 120 }, 130, 9, 0.6, 10, 0, { calcium_mg: 100 }, 50, 380],
  ["Paneer curry (e.g. matar paneer)", ["matar paneer", "paneer butter masala", "palak paneer"], "mixed_dish", "vegetarian", [D], 150, "g", { katori: 150, bowl: 200 }, 282, 11, 10, 22, 2, { calcium_mg: 150 }, null, null],
  ["Ghee", ["clarified butter"], "fat", "vegetarian", [D], 1, "tsp", { tsp: 5, tbsp: 15 }, 45, 0, 0, 5, 0, {}, 5, 650],
  ["Butter", ["makhan"], "fat", "vegetarian", [D], 1, "tsp", { tsp: 5, tbsp: 15 }, 36, 0, 0, 4, 0, {}, 5, 550],
  ["Cooking oil", ["oil", "refined oil", "mustard oil", "sunflower oil", "groundnut oil"], "fat", "vegan", [], 1, "tsp", { tsp: 5, tbsp: 15 }, 45, 0, 0, 5, 0, {}, 5, 140],
  // ---- meat and fish
  ["Chicken breast, cooked (no skin)", ["grilled chicken", "boiled chicken", "chicken breast"], "meat", "non_vegetarian", [], 100, "g", { piece: 150, katori: 100 }, 160, 31, 0, 3.5, 0, { vitamin_b12_mcg: 0.3 }, 140, 240],
  ["Chicken curry", ["murgh curry", "chicken gravy"], "mixed_dish", "non_vegetarian", [], 150, "g", { katori: 150, bowl: 200 }, 222, 18, 6, 14, 1, {}, 120, 240],
  ["Tandoori chicken", ["chicken tikka", "tandoori chicken leg"], "meat", "non_vegetarian", [D], 100, "g", { piece: 120 }, 155, 20, 3, 7, 0.5, {}, 130, 240],
  ["Fish curry", ["machher jhol", "fish gravy", "meen curry"], "mixed_dish", "non_vegetarian", [F], 150, "g", { katori: 150, bowl: 200 }, 178, 17, 5, 10, 0.5, { vitamin_b12_mcg: 2 }, 120, 260],
  ["Fried fish", ["fish fry", "rohu fry"], "fish", "non_vegetarian", [F], 100, "g", { piece: 80 }, 186, 20, 4, 10, 0.3, { vitamin_b12_mcg: 2 }, 110, 260],
  ["Mutton curry", ["gosht curry", "goat curry"], "mixed_dish", "non_vegetarian", [], 150, "g", { katori: 150, bowl: 200 }, 298, 20, 5, 22, 1, {}, null, null],
  ["Chicken biryani", ["biryani", "hyderabadi biryani"], "mixed_dish", "non_vegetarian", [D], 300, "g", { plate: 300, katori: 150 }, 461, 22, 55, 17, 2, {}, null, null],
  ["Veg biryani", ["vegetable biryani", "veg pulao"], "mixed_dish", "vegetarian", [D], 300, "g", { plate: 300, katori: 150 }, 422, 9, 65, 14, 3, {}, null, null],
  // ---- vegetables
  ["Mixed vegetable sabzi", ["sabzi", "mixed veg", "vegetable curry"], "vegetable", "vegan", [], 100, "g", { katori: 100, bowl: 150 }, 82, 2.5, 9, 4, 3, {}, 120, 50],
  ["Aloo sabzi (potato)", ["aloo", "potato curry", "aloo fry"], "vegetable", "vegan", [], 100, "g", { katori: 100, bowl: 150 }, 121, 2, 17, 5, 2, {}, 120, 30],
  ["Aloo gobi", ["potato cauliflower"], "vegetable", "vegan", [], 100, "g", { katori: 100, bowl: 150 }, 100, 2.5, 10, 5.5, 3, {}, 110, 40],
  ["Palak sabzi (spinach)", ["spinach", "saag", "palak"], "vegetable", "vegan", [], 100, "g", { katori: 100, bowl: 150 }, 70, 3.5, 5, 4, 2.5, { iron_mg: 1.5, calcium_mg: 90 }, 150, 40],
  ["Bhindi (okra) sabzi", ["okra", "ladies finger", "bhindi fry"], "vegetable", "vegan", [], 100, "g", { katori: 100 }, 90, 2, 8, 5.5, 3.5, {}, 130, 60],
  ["Baingan bharta", ["brinjal bharta", "eggplant"], "vegetable", "vegan", [], 100, "g", { katori: 100 }, 92, 2, 8, 6, 3, {}, 150, 45],
  ["Green salad (cucumber, tomato, onion)", ["salad", "kachumber"], "vegetable", "vegan", [], 100, "g", { katori: 80, bowl: 150, plate: 150 }, 22, 1, 4.5, 0.2, 1.3, { vitamin_c_mg: 10 }, 100, 40],
  ["Cucumber", ["kheera", "kakdi"], "vegetable", "vegan", [], 100, "g", { piece: 200 }, 15, 0.7, 3.6, 0.1, 0.5, {}, 100, 30],
  ["Tomato", ["tamatar"], "vegetable", "vegan", [], 100, "g", { piece: 100 }, 20, 0.9, 3.9, 0.2, 1.2, { vitamin_c_mg: 15 }, 100, 40],
  ["Onion", ["pyaz", "kanda"], "vegetable", "vegan", [], 100, "g", { piece: 100 }, 40, 1.1, 9.3, 0.1, 1.7, {}, 100, 35],
  ["Carrot", ["gajar"], "vegetable", "vegan", [], 100, "g", { piece: 80 }, 41, 0.9, 9.6, 0.2, 2.8, {}, 100, 45],
  ["Boiled potato", ["aloo boiled"], "vegetable", "vegan", [], 100, "g", { piece: 120 }, 87, 1.9, 20, 0.1, 1.8, {}, 100, 30],
  ["Boiled sweet potato", ["shakarkandi", "sweet potato"], "vegetable", "vegan", [], 100, "g", { piece: 150 }, 90, 1.6, 21, 0.1, 3, {}, 100, 50],
  // ---- fruits
  ["Banana", ["kela"], "fruit", "vegan", [], 1, "piece", { piece: 100 }, 89, 1.1, 22.8, 0.3, 2.6, { vitamin_c_mg: 9 }, 150, 60],
  ["Apple", ["seb"], "fruit", "vegan", [], 1, "piece", { piece: 150 }, 78, 0.4, 20.7, 0.3, 3.6, { vitamin_c_mg: 7 }, 170, 180],
  ["Orange / mosambi", ["santra", "orange", "mosambi", "sweet lime"], "fruit", "vegan", [], 1, "piece", { piece: 130 }, 62, 1.2, 15.4, 0.2, 3.1, { vitamin_c_mg: 70 }, 200, 100],
  ["Guava", ["amrud"], "fruit", "vegan", [], 1, "piece", { piece: 100 }, 68, 2.6, 14.3, 1, 5.4, { vitamin_c_mg: 200 }, 110, 70],
  ["Papaya", ["papita"], "fruit", "vegan", [], 100, "g", { katori: 120, bowl: 150 }, 43, 0.5, 11, 0.3, 1.7, { vitamin_c_mg: 60 }, 130, 50],
  ["Mango", ["aam"], "fruit", "vegan", [], 100, "g", { piece: 200, katori: 120 }, 60, 0.8, 15, 0.4, 1.6, { vitamin_c_mg: 36 }, 150, 100],
  ["Watermelon", ["tarbooz"], "fruit", "vegan", [], 150, "g", { katori: 150, bowl: 250 }, 45, 0.9, 11.3, 0.2, 0.6, {}, 220, 25],
  // ---- nuts, seeds, snacks
  ["Peanuts (roasted)", ["moongfali", "groundnuts", "mungfali"], "nut_seed", "vegan", [P], 30, "g", { katori: 100, tbsp: 10 }, 170, 7.8, 4.9, 14.2, 2.5, {}, 30, 130],
  ["Almonds", ["badam"], "nut_seed", "vegan", [N], 12, "g", { piece: 1.2 }, 69, 2.5, 2.6, 6, 1.5, { calcium_mg: 32 }, 12, 800],
  ["Roasted chana", ["bhuna chana", "roasted gram"], "snack", "vegan", [], 30, "g", { katori: 60, tbsp: 8 }, 110, 6, 18, 1.5, 5, { iron_mg: 1.4 }, 30, 120],
  ["Makhana (fox nuts)", ["phool makhana", "lotus seeds"], "snack", "vegan", [], 30, "g", { katori: 20, cup: 20 }, 104, 2.9, 23, 0.1, 0.5, {}, 30, 1200],
  ["Peanut butter", ["pb"], "nut_seed", "vegan", [P], 1, "tbsp", { tbsp: 16, tsp: 5 }, 95, 4, 3, 8, 1, {}, 16, 300],
  ["Samosa", ["aloo samosa"], "snack", "vegan", [G], 1, "piece", { piece: 80 }, 260, 4, 25, 16, 2, {}, null, null],
  ["Veg sandwich", ["sandwich", "bread sandwich"], "snack", "vegetarian", [G, D], 1, "piece", { piece: 120 }, 220, 6, 32, 7.5, 3, {}, null, null],
  ["Pav bhaji (2 pav)", ["pav bhaji", "pao bhaji"], "mixed_dish", "vegetarian", [G, D], 1, "plate", { plate: 300 }, 508, 12, 70, 20, 7, {}, null, null],
  ["Instant noodles (1 packet, prepared)", ["maggi", "noodles", "instant noodles"], "snack", "vegan", [G], 1, "piece", { piece: 280, plate: 280 }, 329, 7, 46, 13, 2, {}, 70, null],
  ["Gulab jamun", ["jamun"], "sweet", "vegetarian", [D, G], 1, "piece", { piece: 40 }, 150, 2, 22, 6, 0.2, {}, null, null],
  ["Chai (milk tea with sugar)", ["tea", "milk tea", "masala chai"], "beverage", "vegetarian", [D], 150, "ml", { cup: 150, glass: 200 }, 66, 1.5, 10.5, 2, 0, { calcium_mg: 60 }, null, null],
  ["Sugar", ["cheeni", "shakkar"], "other", "vegan", [], 1, "tsp", { tsp: 4, tbsp: 12 }, 16, 0, 4, 0, 0, {}, 4, 48],
];
