import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  Divider,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Chip,
  SelectChangeEvent,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { createUser, updateUser, fetchUserById, clearCurrentUser } from '../store/userSlice';

const UserForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isEditMode = Boolean(id);
  
  const { currentUser, loading, error } = useAppSelector((state) => state.users);

  const [formData, setFormData] = useState({
    nip: '',
    email: '',
    username: '',
    first_name: '',
    last_name: '',
    status: 'active' as 'active' | 'disabled' | 'suspended',
    birth_date: '',
    gender: '',
    bio: '',
    timezone: '',
    locale: '',
    cabang: '',
    regency: '',
    loc_code: '',
    location_name: '',
    cost_center_name: '',
    job_type: '',
    position: '',
    grade: '',
    join_date: '',
    emp_type: '',
    start_work: '',
    last_day: '',
    remarks: '',
    roles: [] as string[],
    allowed_applications: [] as string[],
    allow_dashboard_access: true,
    password: '',
    force_password_change: false,
  });

  const [availableRoles, setAvailableRoles] = useState<{id: string, name: string}[]>([]);

  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode && id) {
      dispatch(fetchUserById(id));
    } else {
      dispatch(clearCurrentUser());
    }

    // Fetch roles
    const fetchRoles = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL || '/sso-api'}/roles`);
        setAvailableRoles(res.data);
      } catch (err) {
        console.error('Failed to fetch roles', err);
      }
    };
    fetchRoles();
  }, [dispatch, id, isEditMode]);

  useEffect(() => {
    if (isEditMode && currentUser) {
      setFormData({
        nip: currentUser.nip || '',
        email: currentUser.email || '',
        username: currentUser.username || '',
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        status: currentUser.status || 'active',
        birth_date: currentUser.birth_date ? currentUser.birth_date.substring(0, 10) : '',
        gender: currentUser.gender || '',
        bio: currentUser.bio || '',
        timezone: currentUser.timezone || '',
        locale: currentUser.locale || '',
        cabang: currentUser.cabang || '',
        regency: currentUser.regency || '',
        loc_code: currentUser.loc_code || '',
        location_name: currentUser.location_name || '',
        cost_center_name: currentUser.cost_center_name || '',
        job_type: currentUser.job_type || '',
        position: currentUser.position || '',
        grade: currentUser.grade || '',
        join_date: currentUser.join_date ? currentUser.join_date.substring(0, 10) : '',
        emp_type: currentUser.emp_type || '',
        start_work: currentUser.start_work ? currentUser.start_work.substring(0, 10) : '',
        last_day: currentUser.last_day ? currentUser.last_day.substring(0, 10) : '',
        remarks: currentUser.remarks || '',
        roles: currentUser.roles ? currentUser.roles.map((r: any) => typeof r === 'object' ? r.id : r) : [],
        allowed_applications: currentUser.allowed_applications || [],
        allow_dashboard_access: currentUser.allow_dashboard_access !== false,
        password: '',
        force_password_change: currentUser.force_password_change || false,
      });
    }
  }, [currentUser, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }> | SelectChangeEvent<string[]>) => {
    const name = e.target.name as string;
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    
    try {
      if (isEditMode && id) {
        await dispatch(updateUser({ id, data: formData })).unwrap();
      } else {
        await dispatch(createUser(formData)).unwrap();
      }
      navigate('/users');
    } catch (err: any) {
      setSubmitError(err.message || 'An error occurred during save.');
    }
  };

  if (loading && isEditMode) {
    return <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {isEditMode ? 'Edit User' : 'Add New User'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {submitError && <Alert severity="error" sx={{ mb: 3 }}>{submitError}</Alert>}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="NIP (Nomor Induk Pegawai)"
                name="nip"
                value={formData.nip}
                onChange={handleChange}
                required
                disabled={isEditMode && Boolean(currentUser?.nip)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={isEditMode}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="email"
                label="Email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isEditMode}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Status"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="disabled">Disabled</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="roles-label">Roles</InputLabel>
                <Select
                  labelId="roles-label"
                  id="roles"
                  multiple
                  name="roles"
                  value={formData.roles}
                  onChange={handleChange as any}
                  input={<OutlinedInput id="select-multiple-chip" label="Roles" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => {
                        const strValue = typeof value === 'object' && value !== null ? (value as any).id || JSON.stringify(value) : String(value);
                        const role = availableRoles.find(r => r.id === strValue || r.id === value);
                        const labelText = role ? role.name : strValue;
                        return <Chip key={strValue} label={labelText} />;
                      })}
                    </Box>
                  )}
                >
                  {availableRoles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h6" gutterBottom>
            HR Information
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Cabang" name="cabang" value={formData.cabang} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Regency" name="regency" value={formData.regency} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Loc Code" name="loc_code" value={formData.loc_code} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Location Name" name="location_name" value={formData.location_name} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Cost Center Name" name="cost_center_name" value={formData.cost_center_name} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Job Type" name="job_type" value={formData.job_type} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Position" name="position" value={formData.position} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Grade" name="grade" value={formData.grade} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="date" label="Join Date" name="join_date" value={formData.join_date} onChange={handleChange} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Employee Type" name="emp_type" value={formData.emp_type} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="date" label="Start Work" name="start_work" value={formData.start_work} onChange={handleChange} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="date" label="Last Day" name="last_day" value={formData.last_day} onChange={handleChange} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2} label="Remarks" name="remarks" value={formData.remarks} onChange={handleChange} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 4 }} />



          <Typography variant="h6" gutterBottom>
            Security Settings
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.allow_dashboard_access}
                  onChange={(e) => setFormData(prev => ({ ...prev, allow_dashboard_access: e.target.checked }))}
                  name="allow_dashboard_access"
                  color="primary"
                />
              }
              label="Allow Login to SSO Admin Dashboard"
            />
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="password"
                label={isEditMode ? "New Password (leave blank to keep current)" : "Password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required={!isEditMode}
              />
            </Grid>
            <Grid item xs={12} sm={6} display="flex" alignItems="center">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.force_password_change}
                    onChange={(e) => setFormData(prev => ({ ...prev, force_password_change: e.target.checked }))}
                    name="force_password_change"
                  />
                }
                label="Force password change on next login"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h6" gutterBottom>
            Profile Information
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Birth Date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
              >
                <MenuItem value="">Unspecified</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Timezone"
                name="timezone"
                placeholder="e.g. UTC, Asia/Jakarta"
                value={formData.timezone}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Locale"
                name="locale"
                placeholder="e.g. en-US, id-ID"
                value={formData.locale}
                onChange={handleChange}
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={() => navigate('/users')}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save User'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default UserForm;
