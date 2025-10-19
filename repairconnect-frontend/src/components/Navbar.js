// src/components/Navbar.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { decodeToken } from '../utils/jwt';
import styles from './Navbar.module.css';

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = token ? decodeToken(token) : null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.brand}>
        RepairConnect
      </Link>
      <ul className={styles.navLinks}>
        {!user && (
          <>
            <li>
              <Link to="/login">Login</Link>
            </li>
            <li>
              <Link to="/register">Register</Link>
            </li>
            <li>
              <Link to="/admin/login">Admin</Link>
            </li>
          </>
        )}
        {user && (
          <>
            {user.role === 'customer' && (
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
            )}
            {user.role === 'provider' && (
              <li>
                <Link to="/provider/dashboard">Dashboard</Link>
              </li>
            )}
            {user.role === 'admin' && (
              <li>
                <Link to="/admin/dashboard">Admin Dashboard</Link>
              </li>
            )}
            <li>
              <button onClick={handleLogout} className={styles.logoutButton}>
                Logout
              </button>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}

export default Navbar;
