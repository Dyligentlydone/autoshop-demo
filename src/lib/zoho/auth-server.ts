
import axios from 'axios';

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com';

let accessToken = '';
let tokenExpiresAt = 0;

const getConfig = () => {
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN || '';
  const clientId = process.env.ZOHO_CLIENT_ID || '';
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || '';

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error(
      'Missing Zoho server env vars (ZOHO_CLIENT_ID/ZOHO_CLIENT_SECRET/ZOHO_REFRESH_TOKEN)'
    );
  }

  return { refreshToken, clientId, clientSecret };
};

const isTokenExpired = () => Date.now() >= tokenExpiresAt;

const refreshAccessToken = async (): Promise<string> => {
  const { refreshToken, clientId, clientSecret } = getConfig();

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
  tokenExpiresAt = Date.now() + (response.data.expires_in - 600) * 1000;
  return accessToken;
};

export const getZohoAccessToken = async (forceRefresh = false): Promise<string> => {
  if (forceRefresh || !accessToken || isTokenExpired()) {
    return refreshAccessToken();
  }
  return accessToken;
};
