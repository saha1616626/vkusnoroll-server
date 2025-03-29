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