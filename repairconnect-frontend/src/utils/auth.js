import jwt_decode from 'jwt-decode';

const TOKEN_KEY = 'token';

export const setToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const isAuthenticated = () => {
  const token = getToken();
  if (!token) return false;

  try {
    const decoded = jwt_decode(token);
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
    const decoded = jwt_decode(token);
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
    const decoded = jwt_decode(token);
    console.log('Decoded user data:', decoded);
    return decoded;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};