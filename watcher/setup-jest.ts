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
      return originalAxios.get(url, config);
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
      const retval = await originalAxios.post(url, data, config);
      // console.log('post retval', stringify(retval));
      return retval;
    }),
  };
});
