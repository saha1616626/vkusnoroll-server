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
    "isPrivateHome",
    latitude,
    longitude
FROM "deliveryAddress"
`;

// Получить адрес по id
exports.getDeliveryAddressByIdQuery = `
    ${exports.getDeliveryAddressesQuery}
    WHERE id = $1
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
    "isPrivateHome",
    latitude,
    longitude)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
    "isPrivateHome" = $8,
    latitude = $9,
    longitude = $10
  WHERE id = $11
  RETURNING *
`;

// Удалить адрес клиента
exports.deleteDeliveryAddressQuery = `
    DELETE 
        FROM "deliveryAddress" 
    WHERE id = $1
`;