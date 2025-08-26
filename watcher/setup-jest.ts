import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import crypto from 'crypto';

dotenv.config();
process.env.LOG_LEVEL = 'warn';
process.env.DB_SOURCE = 'local';

jest.mock('axios', () => {
  const originalAxios = jest.requireActual('axios') as any;
  return {
    get: jest.fn(async (url: string, config?: any) => {
      const mockDataPath = `${__dirname}/mock/${url
        .replace('http://', '')
        .replace('https://', '')}`;
      if (existsSync(mockDataPath)) {
        return { data: JSON.parse(readFileSync(mockDataPath, 'utf8')) };
      }
      try {
        const response = await originalAxios.get(url, config);
        return { data: response.data, status: response.status, statusText: response.statusText };
      } catch (error: any) {
        // Create clean error without circular references
        const cleanError = new Error(error.message);
        cleanError.name = 'AxiosError';
        Object.assign(cleanError, {
          code: error.code,
          response: error.response
            ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
              }
            : undefined,
        });
        throw cleanError;
      }
    }),
    post: jest.fn(async (url: string, data?: any, config?: any) => {
      const dataHash = Buffer.from(
        await crypto.subtle.digest('SHA-256', Buffer.from(JSON.stringify(data)))
      ).toString('hex');
      const mockDataPath = `${__dirname}/mock/${url
        .replace('http://', '')
        .replace('https://', '')}/${dataHash}`;
      // console.log('post mockDataPath', mockDataPath);
      if (existsSync(mockDataPath)) {
        return { data: JSON.parse(readFileSync(mockDataPath, 'utf8')) };
      }
      // console.log('axios.post', url);
      try {
        const response = await originalAxios.post(url, data, config);
        return { data: response.data, status: response.status, statusText: response.statusText };
      } catch (error: any) {
        // Create clean error without circular references
        const cleanError = new Error(error.message);
        cleanError.name = 'AxiosError';
        Object.assign(cleanError, {
          code: error.code,
          response: error.response
            ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
              }
            : undefined,
        });
        throw cleanError;
      }
    }),
  };
});
