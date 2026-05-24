import axios from 'axios';

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com';
const ZOHO_API_URL = 'https://www.zohoapis.com/crm/v2';

let accessToken = '';
let refreshToken = process.env.NEXT_PUBLIC_ZOHO_REFRESH_TOKEN || '';
let clientId = process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID || '';
let clientSecret = process.env.NEXT_PUBLIC_ZOHO_CLIENT_SECRET || '';
let tokenExpiresAt = 0;

export const initializeZoho = (config: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) => {
  clientId = config.clientId;
  clientSecret = config.clientSecret;
  refreshToken = config.refreshToken;
};

const isTokenExpired = () => {
  return Date.now() >= tokenExpiresAt;
};

const refreshAccessToken = async (): Promise<string> => {
  try {
    const response = await axios.post(
      `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`,
      new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      })
    );

    accessToken = response.data.access_token;
    // Set token to expire 10 minutes before actual expiry to be safe
    tokenExpiresAt = Date.now() + (response.data.expires_in - 600) * 1000;

    return accessToken;
  } catch (error) {
    console.error('Error refreshing Zoho access token:', error);
    throw new Error('Failed to refresh Zoho access token');
  }
};

export const getAccessToken = async (): Promise<string> => {
  if (!accessToken || isTokenExpired()) {
    return await refreshAccessToken();
  }
  return accessToken;
};

export const makeZohoRequest = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any
): Promise<T> => {
  const token = await getAccessToken();
  const url = `${ZOHO_API_URL}${endpoint}`;

  try {
    const response = await axios({
      method,
      url,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      data,
    });

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      // Token might be expired, refresh and retry once
      const newToken = await refreshAccessToken();
      const retryResponse = await axios({
        method,
        url,
        headers: {
          'Authorization': `Zoho-oauthtoken ${newToken}`,
          'Content-Type': 'application/json',
        },
        data,
      });
      return retryResponse.data;
    }
    console.error('Zoho API request failed:', error);
    throw error;
  }
};
