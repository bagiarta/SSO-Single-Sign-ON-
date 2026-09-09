import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Chip, Stack, Checkbox, FormControlLabel, Divider, Grid
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, AdminPanelSettings as AdminIcon, Person as PersonIcon, Shield as ShieldIcon } from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_BASE_URL || '/sso-api';

const AVAILABLE_PERMISSIONS = ['read', 'write', 'delete', 'manage_users', 'manage_clients'];

export const RoleList: React.FC = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', permissions: [] as string[] });

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/roles`);
      setRoles(response.data);
    } catch (error) {
      console.error('Error fetching roles', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreate = async () => {
    try {
      await axios.post(`${API_URL}/roles`, formData);
      setOpenForm(false);
      setFormData({ name: '', description: '', permissions: [] });
      fetchRoles();
    } catch (error) {
      console.error('Error creating role', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    try {
      await axios.delete(`${API_URL}/roles/${id}`);
      fetchRoles();
    } catch (error) {
      console.error('Error deleting role', error);
    }
  };

  const handlePermissionToggle = (perm: string) => {
    setFormData(prev => {
      const newPerms = prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm];
      return { ...prev, permissions: newPerms };
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Roles & Access</Typography>
          <Typography variant="body2" color="text.secondary">Kelola tingkat akses dan peran (RBAC) pada sistem SSO Anda.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenForm(true)}>
          Create Custom Role
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600 }}>Role Profile</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Permissions Matrix</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}>Loading...</TableCell></TableRow>
            ) : (
              roles.map((role) => {
                let parsedPermissions: string[] = [];
                try {
                  parsedPermissions = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;
                } catch { }

                return (
                  <TableRow key={role.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ p: 1, bgcolor: role.name.toLowerCase() === 'admin' ? 'error.light' : 'primary.light', borderRadius: 2, color: 'white', display: 'flex' }}>
                          {role.name.toLowerCase() === 'admin' ? <AdminIcon /> : <PersonIcon />}
                        </Box>
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>{role.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{role.description}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        icon={<ShieldIcon fontSize="small" />} 
                        label={role.is_system ? 'SYSTEM' : 'CUSTOM'} 
                        color={role.is_system ? 'default' : 'primary'} 
                        size="small" 
                        variant={role.is_system ? 'outlined' : 'filled'}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ maxWidth: 350 }}>
                        {AVAILABLE_PERMISSIONS.map(perm => {
                          const hasPerm = parsedPermissions?.includes(perm) || parsedPermissions?.includes('all');
                          return (
                            <Chip 
                              key={perm} 
                              label={perm.replace('_', ' ')} 
                              size="small" 
                              color={hasPerm ? 'success' : 'default'} 
                              variant={hasPerm ? 'filled' : 'outlined'}
                              sx={{ opacity: hasPerm ? 1 : 0.4, fontSize: '0.65rem' }}
                            />
                          );
                        })}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {!role.is_system ? (
                        <IconButton color="error" onClick={() => handleDelete(role.id)} size="small" sx={{ bgcolor: 'error.lighter' }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <Typography variant="caption" color="text.disabled">Protected</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create Custom Role</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TextField
              autoFocus margin="dense" label="Role Name" fullWidth required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense" label="Description" fullWidth multiline rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              sx={{ mb: 3 }}
            />
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Permissions Matrix</Typography>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Grid container spacing={1}>
                {AVAILABLE_PERMISSIONS.map(perm => (
                  <Grid item xs={6} key={perm}>
                    <FormControlLabel
                      control={
                        <Checkbox 
                          checked={formData.permissions.includes(perm)} 
                          onChange={() => handlePermissionToggle(perm)} 
                          color="success"
                        />
                      }
                      label={<Typography variant="body2">{perm.replace('_', ' ').toUpperCase()}</Typography>}
                    />
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenForm(false)} color="inherit">Cancel</Button>
          <Button onClick={handleCreate} variant="contained" color="primary" disabled={!formData.name}>Create Role</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoleList;
