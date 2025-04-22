import bcrypt from 'bcrypt';
import { salt_rounds } from '../config/env_config.js';

// Hash password
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, salt_rounds);
};

// Compare hashed password
export const compareHashedPasswords = async (
  plainPassword,
  hashedPassword,
) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};
