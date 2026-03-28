// Cuando tengamos el API Gateway real apuntando a tus Lambdas de AWS, 
// solo tendrás que crear un archivo 'orderAws.js' y cambiar la importación de abajo.
//
// TODO: import { OrderAdapter } from './orderAws.js';

import { OrderAdapter } from './orderMock.js';

export const api = OrderAdapter;
