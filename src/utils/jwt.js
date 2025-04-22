import jwt from 'jsonwebtoken';

import {  jwt_secret } from '../config/env_config.js';


export const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, jwt_secret, { expiresIn: '60d' });
};

export const verifyToken = (token) => {
  return jwt.verify(token, jwt_secret);
};
