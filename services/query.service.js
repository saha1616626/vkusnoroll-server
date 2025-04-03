// Сервис запросов

// Получаем список категорий блюд
exports.getCategoriesQuery = `
SELECT
    *
  FROM category
`;

// Получаем список блюд, где id категории заменен на название
exports.getDishesQuery = `
SELECT
    d.id, 
    d.name, 
    d.description,
    d."categoryId",
    c.name as category,
    d.price,
    d."isNutritionalValue",
    d.calories,
    d.fats,
    d.squirrels,
    d.carbohydrates,
    d."isWeight",
    d.weight,
    d."isQuantitySet",
    d.quantity,
    d."isVolume",
    d.volume,
    d."isArchived",
    d.image
  FROM dish d
  JOIN category c ON d."categoryId" = c.id
`;

// Получаем блюдо по id
exports.getDishByIdQuery = `
  ${exports.getDishesQuery}
  WHERE d.id = $1
`;

// Добавляем блюдо
exports.createDishQuery = `
  INSERT INTO dish (
    name, description, "categoryId", "isNutritionalValue", calories, fats, squirrels, carbohydrates, "isWeight", weight, "isQuantitySet", quantity, "isVolume", volume, price, "isArchived", image
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
  RETURNING *
`;

// Изменяем блюдо
exports.updateDishQuery = `
  UPDATE dish SET
    name = $1,
    description = $2,
    "categoryId" = $3,
    price = $4,
    "isNutritionalValue" = $5,
    calories = $6,
    fats = $7,
    squirrels = $8,
    carbohydrates = $9,
    "isWeight" = $10,
    weight = $11,
    "isQuantitySet" = $12,
    quantity = $13,
    "isVolume" = $14,
    volume = $15,
    "isArchived" = $16,
    image = $17
  WHERE id = $18
  RETURNING *
`;