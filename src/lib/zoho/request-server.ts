
import axios from 'axios';
import { getZohoAccessToken } from './auth-server';

const ZOHO_API_URL = 'https://www.zohoapis.com/crm/v2';

export const makeZohoServerRequest = async <T>(params: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  data?: unknown;
}): Promise<T> => {
  const url = `${ZOHO_API_URL}${params.endpoint}`;

  const make = async (token: string) => {
    const res = await axios({
      method: params.method,
      url,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      data: params.data,
    });

    return res.data as T;
  };

  try {
    const token = await getZohoAccessToken();
    return await make(token);
  } catch (err: any) {
    if (err?.response?.status === 401) {
      const token = await getZohoAccessToken(true); // Force refresh on 401
      return await make(token);
    }

    throw err;
  }
};
