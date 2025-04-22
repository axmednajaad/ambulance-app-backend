import dotenv from 'dotenv';

dotenv.config();

function requireEnv(varName) {
  const value = process.env[varName];
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${varName}`);
  }
  return value;
}

export const node_env = process.env.NODE_ENV ?? 'development';
export const port = parseInt(process.env.PORT || '3000');
export const server_url = requireEnv('SERVER_URL');
export const google_map_api_key = requireEnv('GOOGLE_MAP_API_KEY');
export const salt_rounds = parseInt(process.env.SALT_ROUND || '10');
export const jwt_secret = requireEnv('JWT_SECRET');
