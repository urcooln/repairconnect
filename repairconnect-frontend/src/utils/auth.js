import jwtDecode from 'jwt-decode';

const TOKEN_KEY = 'token';
const COOKIE_KEY = 'rc_token';

const isBrowser = typeof window !== 'undefined';

const setCookieToken = (value) => {
  if (!isBrowser) return;
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/`;
};

const getCookieToken = () => {
  if (!isBrowser) return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const clearCookieToken = () => {
  if (!isBrowser) return;
  document.cookie = `${COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
};

export const setToken = (token) => {
  if (!isBrowser) return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    setCookieToken(token);
  }
};

export const getToken = () => {
  if (!isBrowser) return null;
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = getCookieToken();
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }
  return token;
};

export const removeToken = () => {
  if (!isBrowser) return;
  localStorage.removeItem(TOKEN_KEY);
  clearCookieToken();
};

export const isAuthenticated = () => {
  const token = getToken();
  if (!token) return false;

  try {
    const decoded = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    return decoded.exp > currentTime;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

export const getUserRole = () => {
  const token = getToken();
  if (!token) return null;

  try {
    const decoded = jwtDecode(token);
    return decoded.role;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

export const getUserData = () => {
  const token = getToken();
  console.log('Token from storage:', token);
  if (!token) return null;

  try {
    const decoded = jwtDecode(token);
    console.log('Decoded user data:', decoded);
    return decoded;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};
