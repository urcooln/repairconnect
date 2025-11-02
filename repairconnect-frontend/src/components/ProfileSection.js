import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import styles from '../pages/ProviderDashboard.module.css'; 

const API_BASE = "http://localhost:8081"; // Backend URL

const AVAILABLE_ROLES = [
  'Plumber',
  'Electrician',
  'Carpenter',
  'HVAC Technician',
  'Painter',
  'General Contractor',
  'Landscaper',
  'Appliance Repair',
  'Roofer',
  'Locksmith'
];

const ProfileSection = ({ provider, onSave }) => {
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState(provider.roles || []);
  const [photo, setPhoto] = useState(provider.photoUrl);

  const handleLogout = async () => {
    const payload = {
      email: provider.email,
      photoUrl: photo,
      roles: selectedRoles
    };

    try {
      await fetch(`${API_BASE}/saveProfile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      localStorage.clear();
      sessionStorage.clear();
      navigate('/');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png']
    },
    multiple: false
  });

  const handleSave = () => {
    onSave({
      ...provider,
      roles: selectedRoles,
      photoUrl: photo
    });
    setIsEditing(false);
  };

  const toggleRole = (role) => {
    setSelectedRoles(prev => 
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  return (
    <div className={styles.topSection}>
      <div className={styles.profileHeader}>
        <div className={styles.photoUpload} {...getRootProps()}>
          <input {...getInputProps()} />
          {photo ? (
            <img src={photo} alt={provider.firstName} />
          ) : (
            <p>Drop or click to upload photo</p>
          )}
        </div>

        <div className={styles.providerInfo}>
          <h2>{`${provider.firstName} ${provider.lastName}`}</h2>
          <div className={styles.rolesList}>
            {(provider.roles || []).map(role => (
              <span key={role} className={styles.roleChip}>{role}</span>
            ))}
          </div>
        </div>

        <button 
          className={styles.editButton}
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
        >
          {isEditing ? 'Save Changes' : 'Edit Profile'}
        </button>
        <button
          className={`${styles.editButton} bg-red-500 hover:bg-red-600 text-white ml-4`}
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>

      <div className={styles.stats}>
        <div className={styles.statBox}>
          <h3>Completed Jobs</h3>
          <p>{provider.completedJobs || 0}</p>
        </div>
        <div className={styles.statBox}>
          <h3>New Messages</h3>
          <p>{provider.newMessages || 0}</p>
        </div>
      </div>

      {isEditing && (
        <div className={styles.editProfileModal}>
          <h3>Select Your Services</h3>
          <div className={styles.rolesList}>
            {AVAILABLE_ROLES.map(role => (
              <button
                key={role}
                onClick={() => toggleRole(role)}
                className={`${styles.roleChip} ${
                  selectedRoles.includes(role) ? styles.active : ''
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSection;