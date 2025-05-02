// Сервис запросов. Адреса доставки

// Получить список всех адресов доставки
exports.getDeliveryAddressesQuery = `
SELECT
    id,
    "accountId",
    city, 
    street, 
    house, 
    apartment, 
    entrance, 
    floor, 
    comment, 
    "isPrivateHome"
FROM "deliveryAddress"
`;

// Получить список адресов клиента
exports.getDeliveryAddressesByIdClientQuery = `
    ${exports.getDeliveryAddressesQuery}
    WHERE "accountId" = $1
`;

// Проверка количества адресов пользователя
exports.checkingCountUserAddressesQuery = `
    SELECT 
        count(*) AS address_count
    FROM "deliveryAddress"
    where "accountId" = $1
`;

// Создать адрес доставки клиента
exports.createDeliveryAddressQuery = `
  INSERT INTO "deliveryAddress" (
    "accountId",
    city, 
    street, 
    house, 
    apartment, 
    entrance, 
    floor, 
    comment, 
    "isPrivateHome")
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING *
`;

// Обновить адрес клиента
exports.updateDeliveryAddressQuery = `
UPDATE "deliveryAddress" SET
    city = $1, 
    street = $2,  
    house = $3,  
    apartment = $4,  
    entrance = $5, 
    floor = $6, 
    comment = $7, 
    "isPrivateHome" = $8
  WHERE id = $9
  RETURNING *
`;

// Удалить адрес клиента
exports.deleteDeliveryAddressQuery = `
    DELETE 
        FROM "deliveryAddress" 
    WHERE id = $1
`;