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
