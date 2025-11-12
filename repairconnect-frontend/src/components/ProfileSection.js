import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import styles from '../pages/ProviderDashboard.module.css';

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
  const [photo, setPhoto] = useState(provider.photoUrl || null);
  const [formValues, setFormValues] = useState({
    firstName: provider.firstName || '',
    lastName: provider.lastName || '',
    company: provider.company || '',
    hourlyRate: provider.hourlyRate != null ? String(provider.hourlyRate) : '',
    skillsInput: Array.isArray(provider.skills) ? provider.skills.join(', ') : '',
    bio: provider.bio || ''
  });
  const [saveError, setSaveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = useCallback(() => {
    setSelectedRoles(provider.roles || []);
    setPhoto(provider.photoUrl || null);
    setFormValues({
      firstName: provider.firstName || '',
      lastName: provider.lastName || '',
      company: provider.company || '',
      hourlyRate: provider.hourlyRate != null ? String(provider.hourlyRate) : '',
      skillsInput: Array.isArray(provider.skills) ? provider.skills.join(', ') : '',
      bio: provider.bio || ''
    });
  }, [provider]);

  useEffect(() => {
    resetForm();
  }, [resetForm]);
  
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    if (isEditing) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isEditing]);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate('/');
  };

  const handleSave = useCallback(async (overrides = {}) => {
    setSaveError(null);

    const trimmedFirstName = formValues.firstName.trim();
    const trimmedLastName = formValues.lastName.trim();
    const trimmedCompany = formValues.company.trim();
    const trimmedBio = formValues.bio.trim();

    const skillsList = formValues.skillsInput
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean);

    const rateInput = formValues.hourlyRate.trim();
    const parsedRate = rateInput === '' ? null : Number.parseFloat(rateInput);

    if (rateInput !== '' && Number.isNaN(parsedRate)) {
      setSaveError('Hourly rate must be a number.');
      return;
    }

    try {
      setIsSaving(true);
      await onSave({
        firstName: overrides.firstName ?? trimmedFirstName,
        lastName: overrides.lastName ?? trimmedLastName,
        company: overrides.company ?? trimmedCompany,
        skills: overrides.skills ?? skillsList,
        hourlyRate: overrides.hourlyRate ?? parsedRate,
        roles: overrides.roles ?? selectedRoles,
        photoUrl: overrides.photoUrl ?? photo,
        bio: overrides.bio ?? trimmedBio
      });
      if (!overrides.skipClose) {
        setIsEditing(false);
      }
    } catch (error) {
      setSaveError(error.message || 'Unable to save profile.');
    } finally {
      setIsSaving(false);
    }
  }, [formValues, selectedRoles, photo, onSave]);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Image = reader.result;
        setPhoto(base64Image);
        try {
          await handleSave({ photoUrl: base64Image, skipClose: true });
        } catch (error) {
          console.error('Failed to auto-save photo:', error);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [handleSave]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.heic']
    },
    multiple: false
  });

  const handleInputChange = (field) => (event) => {
    const { value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCancel = () => {
    resetForm();
    setSaveError(null);
    setIsEditing(false);
  };

  const handleManualSave = () => handleSave();

  const toggleRole = (role) => {
    setSelectedRoles((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role]
    );
  };

  const displayRoles = (provider.roles || []).filter(
    (role) => role && role.toLowerCase() !== 'provider'
  );

  return (
    <div className={styles.topSection}>
      <div className={styles.profileHeader}>
        <div className={styles.photoUpload} {...getRootProps()}>
          <input {...getInputProps()} />
          {photo ? (
            <img src={photo} alt={provider.firstName || provider.email} />
          ) : (
            <p>Drop or click to upload photo</p>
          )}
        </div>

        <div className={styles.profileInfoPanel}>
          <div className={styles.providerInfo}>
            <h2 className={styles.profileName}>
              {`${provider.firstName || ''} ${provider.lastName || ''}`.trim() || provider.email}
            </h2>
            {provider.email && (
              <p className={styles.profileEmail}>{provider.email}</p>
            )}
            {provider.company && (
              <p className={styles.companyName}>{provider.company}</p>
            )}
            {displayRoles.length > 0 && (
              <div className={styles.rolesList}>
                {displayRoles.map((role) => (
                  <span key={role} className={styles.roleChip}>
                    {role}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.profileActions}>
            {!isEditing && (
              <button
                className={styles.editButton}
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </button>
            )}
            <button
              className={`${styles.editButton} ${styles.logoutButton}`}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className={styles.profileDetails}>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Company</span>
          <span className={styles.detailValue}>
            {provider.company || 'Add your company name'}
          </span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Hourly Rate</span>
          <span className={styles.detailValue}>
            {provider.hourlyRate != null
              ? `$${Number(provider.hourlyRate).toFixed(2)}/hr`
              : 'Set your hourly rate'}
          </span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Skills</span>
          <span className={styles.detailValue}>
            {Array.isArray(provider.skills) && provider.skills.length > 0
              ? provider.skills.join(', ')
              : 'Share the skills you offer'}
          </span>
        </div>
        {provider.bio && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>About</span>
            <span className={styles.detailValue}>{provider.bio}</span>
          </div>
        )}
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

      {isEditing && typeof document !== 'undefined' && createPortal(
        <div className={styles.editProfileOverlay}>
          <div className={styles.editProfileModal}>
            <h3 className={styles.modalTitle}>Edit Your Profile</h3>

            <div className={styles.editFormRow}>
              <label htmlFor="first-name">First Name</label>
              <input
                id="first-name"
                type="text"
                value={formValues.firstName}
                onChange={handleInputChange('firstName')}
                placeholder="e.g. Alex"
              />
            </div>

            <div className={styles.editFormRow}>
              <label htmlFor="last-name">Last Name</label>
              <input
                id="last-name"
                type="text"
                value={formValues.lastName}
                onChange={handleInputChange('lastName')}
                placeholder="e.g. Johnson"
              />
            </div>

            <div className={styles.editFormRow}>
              <label htmlFor="company">Company</label>
              <input
                id="company"
                type="text"
                value={formValues.company}
                onChange={handleInputChange('company')}
                placeholder="Your business name"
              />
            </div>

            <div className={styles.editFormRow}>
              <label htmlFor="hourly-rate">Hourly Rate</label>
              <input
                id="hourly-rate"
                type="number"
                min="0"
                step="0.01"
                value={formValues.hourlyRate}
                onChange={handleInputChange('hourlyRate')}
                placeholder="e.g. 75.00"
              />
            </div>

            <div className={styles.editFormRow}>
              <label htmlFor="skills">Skills (comma separated)</label>
              <input
                id="skills"
                type="text"
                value={formValues.skillsInput}
                onChange={handleInputChange('skillsInput')}
                placeholder="e.g. Plumbing, Emergency Repairs"
              />
            </div>

            <div className={styles.editFormRow}>
              <label htmlFor="bio">About You</label>
              <textarea
                id="bio"
                rows="3"
                value={formValues.bio}
                onChange={handleInputChange('bio')}
                placeholder="Tell customers more about your experience"
              />
            </div>

            <div className={styles.rolesSection}>
              <h4>Select Your Services</h4>
              <div className={styles.rolesList}>
                {AVAILABLE_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`${styles.roleChip} ${
                      selectedRoles.includes(role) ? styles.roleChipActive : ''
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {saveError && <p className={styles.errorText}>{saveError}</p>}

            <div className={styles.formActions}>
              <button
                className={styles.editButton}
                onClick={handleManualSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                className={styles.cancelButton}
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProfileSection;
