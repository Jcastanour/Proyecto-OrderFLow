// =========================================================================
// env.js · Variables de entorno del frontend
// -------------------------------------------------------------------------
// Este archivo es un PLACEHOLDER de desarrollo local.
// En producción, Terraform lo sobreescribe en S3 con la URL real del API.
//
// Si API_URL está vacío → el frontend usa el adaptador MOCK (orderMock.js).
// Si tiene valor       → el frontend llama al API Gateway real.
// =========================================================================

window.ENV = {
    API_URL: "https://6jo77mm9w7.execute-api.us-east-1.amazonaws.com"
};
