// Сервис запросов. Настройка рабочего времени ресторана

// Создание элемента рабочего времени
exports.createRestaurantWorkingTimeQuery = `
  INSERT INTO "deliveryWork" (
    date, 
    "isWorking", 
    "startDeliveryWorkTime", 
    "endDeliveryWorkTime")
  VALUES ($1, $2, $3, $4)
  RETURNING *
`;

// Проверка, что дата еще не занята в графике работы
exports.checkDeliveryDateQuery = `
  SELECT EXISTS(
    SELECT 1 
    FROM "deliveryWork" 
    WHERE date = $1
  ) AS "dateExists";
`;

// Проверка, что дата еще не занята в графике работы, за исключением текущей записи
exports.checkDeliveryDateUpdateQuery = `
  SELECT EXISTS(
    SELECT 1 
    FROM "deliveryWork" 
    WHERE date = $1 AND id != $2
  ) AS "dateExists";
`;

// Обновление элемента рабочего времени
exports.updateRestaurantWorkingTimeQuery = `
UPDATE "deliveryWork" SET
    date = $1, 
    "isWorking" = $2, 
    "startDeliveryWorkTime" = $3, 
    "endDeliveryWorkTime" = $4
  WHERE id = $5
  RETURNING *
`;

// Удаление списка элементов графика рабочего времени
exports.deleteRestaurantWorkingTimeQuery = `
  DELETE FROM "deliveryWork"
  WHERE id = ANY($1::integer[])
  RETURNING *
`;

// Получение времени работы доставки на конкретную дату
exports.getDeliveryTimeByDateQuery = `
SELECT * 
  FROM "deliveryWork" 
  WHERE date = $1 
  RETURNING *
`;