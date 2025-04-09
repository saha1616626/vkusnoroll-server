// Сервис запросов


// Категории


// Получаем список категорий блюд
exports.getCategoriesQuery = `
SELECT
    *
  FROM category
`;

// Получаем категорию по id
exports.getСategoryByIdQuery = `
  ${exports.getCategoriesQuery}
  WHERE id = $1
`;

// Добавляем категорию
exports.createСategoryQuery = `
  INSERT INTO category (
    name, description, "isArchived"
  ) VALUES ($1, $2, $3)
  RETURNING *
`;

// Изменяем категорию
exports.updateСategoryQuery = `
  UPDATE category SET
    name = $1,
    description = $2,
    "isArchived" = $3
  WHERE id = $4
  RETURNING *
`;

// Удаление списка категорий
exports.deleteCategoriesQuery = `
  DELETE FROM category
  WHERE id = ANY($1::integer[])
  RETURNING *
`;

// Архивировать/разархивировать категорию
exports.archiveCategoriesQuery = `
  UPDATE category 
  SET "isArchived" = $2
  WHERE id = ANY($1::integer[])
  RETURNING *
`;

// Проверка использования категорий в таблице dish (в блюдах)
exports.checkCategoriesUsageQuery = `
  SELECT 
    c.id,
    c.name,
    EXISTS(SELECT 1 FROM dish WHERE "categoryId" = c.id) as "isUsed"
  FROM category c
  WHERE c.id = ANY($1::integer[]);
`;


// Блюда


// Получаем список блюд, где categoryId категории заменен на название категории
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
    "isNutritionalValue" = $4,
    calories = $5,
    fats = $6,
    squirrels = $7,
    carbohydrates = $8,
    "isWeight" = $9,
    weight = $10,
    "isQuantitySet" = $11,
    quantity = $12,
    "isVolume" = $13,
    volume = $14,
    price = $15,
    "isArchived" = $16,
    image = $17
  WHERE id = $18
  RETURNING *
`;

// Удаление списка блюд
exports.deleteDishesQuery = `
  DELETE FROM dish
  WHERE id = ANY($1::integer[])
  RETURNING *
`;

// Архивировать/разархивировать блюда
exports.archiveDishesQuery = `
  UPDATE dish 
  SET "isArchived" = $2
  WHERE id = ANY($1::integer[])
  RETURNING *
`;

// Проверка использования блюд в таблице compositionOrder (в составе заказа)
exports.checkDishesUsageQuery = `
  SELECT 
    c.id,
    c.name,
    EXISTS(SELECT 1 FROM "compositionOrder" WHERE "dishId" = c.id) as "isUsed"
  FROM dish c
  WHERE c.id = ANY($1::integer[]);
`;


// Новостные посты


// Получаем список новостных постов
exports.getNewsPostsQuery = `
SELECT
    *
  FROM "newsPost"
`;

// Получаем новостной пост по id
exports.getNewsPostByIdQuery = `
  ${exports.getNewsPostsQuery}
  WHERE id = $1
`;

// Добавляем новостной пост
exports.createNewsPostQuery = `
  INSERT INTO "newsPost" (
    "dateTimePublication", image, title, message, "isArchived"
  ) VALUES ($1, $2, $3, $4, $5)
  RETURNING *
`;

// Изменяем новостной пост
exports.updateNewsPostQuery = `
  UPDATE "newsPost" SET
    "dateTimePublication" = $1,
    image = $2,
    title = $3,
    message = $4,
    "isArchived" = $5
  WHERE id = $6
  RETURNING *
`;

// Удаление списка новостей
exports.deleteNewsPostsQuery = `
  DELETE FROM "newsPost"
  WHERE id = ANY($1::integer[])
  RETURNING *
`;

// Архивировать/разархивировать новость
exports.archiveNewsPostsQuery = `
  UPDATE "newsPost" 
  SET "isArchived" = $2
  WHERE id = ANY($1::integer[])
  RETURNING *
`;