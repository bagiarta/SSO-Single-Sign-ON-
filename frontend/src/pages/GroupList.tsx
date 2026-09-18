import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Chip, Stack, Checkbox, FormControlLabel, Grid, Divider
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Group as GroupIcon } from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_BASE_URL || '/sso-api';

export const GroupList: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);

  const [formData, setFormData] = useState<{ id?: string, name: string, description: string, user_ids: string[], client_ids: string[] }>({
    name: '', description: '', user_ids: [], client_ids: []
  });
  
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sso_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [groupsRes, usersRes, clientsRes] = await Promise.all([
        axios.get(`${API_URL}/groups`, { headers }),
        axios.get(`${API_URL}/users?limit=10000`, { headers }),
        axios.get(`${API_URL}/clients`, { headers }),
      ]);
      setGroups(groupsRes.data);
      setAllUsers(usersRes.data.data || usersRes.data);
      setAllClients(clientsRes.data);
    } catch (error) {
      console.error('Error fetching data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setFormData({ name: '', description: '', user_ids: [], client_ids: [] });
    setUserSearchTerm('');
    setOpenForm(true);
  };

  const handleOpenEdit = async (id: string) => {
    try {
      const token = localStorage.getItem('sso_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_URL}/groups/${id}`, { headers });
      const g = response.data;
      setFormData({
        id: g.id,
        name: g.name,
        description: g.description,
        user_ids: g.users?.map((u: any) => u.id) || [],
        client_ids: g.allowed_apps?.map((c: any) => c.id) || []
      });
      setUserSearchTerm('');
      setOpenForm(true);
    } catch (error) {
      console.error('Error fetching group details', error);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('sso_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      if (formData.id) {
        await axios.put(`${API_URL}/groups/${formData.id}`, formData, { headers });
      } else {
        await axios.post(`${API_URL}/groups`, formData, { headers });
      }
      setOpenForm(false);
      fetchData();
    } catch (error) {
      console.error('Error saving group', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;
    try {
      const token = localStorage.getItem('sso_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API_URL}/groups/${id}`, { headers });
      fetchData();
    } catch (error) {
      console.error('Error deleting group', error);
    }
  };

  const toggleUser = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      user_ids: prev.user_ids.includes(userId)
        ? prev.user_ids.filter(id => id !== userId)
        : [...prev.user_ids, userId]
    }));
  };

  const toggleClient = (clientId: string) => {
    setFormData(prev => ({
      ...prev,
      client_ids: prev.client_ids.includes(clientId)
        ? prev.client_ids.filter(id => id !== clientId)
        : [...prev.client_ids, clientId]
    }));
  };

  const getFullName = (u: any) => {
    if (u.name) return u.name;
    if (u.first_name || u.last_name) return `${u.first_name || ''} ${u.last_name || ''}`.trim();
    return u.username || '';
  };

  const filteredUsers = (Array.isArray(allUsers) ? allUsers : []).filter(u => 
    getFullName(u).toLowerCase().includes(userSearchTerm.toLowerCase()) || 
    (u.username || '').toLowerCase().includes(userSearchTerm.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    (u.nip || '').toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Groups & Departments</Typography>
          <Typography variant="body2" color="text.secondary">Kelola grup pengguna dan berikan akses aplikasi massal melalui grup (GBAC).</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          Create Group
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600 }}>Group Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Members</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Allowed Apps</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}>Loading...</TableCell></TableRow>
            ) : (
              (Array.isArray(groups) ? groups : []).map((group) => (
                <TableRow key={group.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'primary.50', color: 'primary.main', display: 'flex' }}>
                        <GroupIcon />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>{group.name}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }} noWrap>
                          {group.description || 'No description'}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={`${group.user_count || 0} Users`} color="default" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {Array.isArray(group.allowed_apps) && group.allowed_apps.length > 0 ? (
                        group.allowed_apps.map((app: any) => (
                          <Chip key={app.id} label={app.name} size="small" variant="outlined" color="primary" />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.disabled">No apps assigned</Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" onClick={() => handleOpenEdit(group.id)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(group.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
            {groups.length === 0 && !loading && (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}>No groups found. Create one to get started.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={600}>{formData.id ? 'Edit Group' : 'Create New Group'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Group Name (e.g. Finance Team)"
              fullWidth
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            
            <Divider />
            
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>Group Members (Users)</Typography>
                  {filteredUsers.length > 0 && (
                    <FormControlLabel
                      control={
                        <Checkbox 
                          size="small"
                          checked={filteredUsers.every(u => formData.user_ids.includes(u.id))}
                          indeterminate={filteredUsers.some(u => formData.user_ids.includes(u.id)) && !filteredUsers.every(u => formData.user_ids.includes(u.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const newIds = new Set(formData.user_ids);
                              filteredUsers.forEach(u => newIds.add(u.id));
                              setFormData(prev => ({ ...prev, user_ids: Array.from(newIds) }));
                            } else {
                              const filteredIds = new Set(filteredUsers.map(u => u.id));
                              setFormData(prev => ({ ...prev, user_ids: prev.user_ids.filter(id => !filteredIds.has(id)) }));
                            }
                          }}
                        />
                      }
                      label={<Typography variant="body2" color="text.secondary">Select All</Typography>}
                    />
                  )}
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search users..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto', p: 1 }}>
                  {filteredUsers.map(user => (
                    <Box key={user.id}>
                      <FormControlLabel
                        control={<Checkbox checked={formData.user_ids.includes(user.id)} onChange={() => toggleUser(user.id)} />}
                        label={<Typography variant="body2">{getFullName(user)} ({user.email || user.nip})</Typography>}
                      />
                    </Box>
                  ))}
                  {filteredUsers.length === 0 && <Typography variant="body2" p={2}>No users found.</Typography>}
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>Allowed Applications</Typography>
                  {allClients && allClients.length > 0 && (
                    <FormControlLabel
                      control={
                        <Checkbox 
                          size="small"
                          checked={formData.client_ids.length === allClients.length && allClients.length > 0}
                          indeterminate={formData.client_ids.length > 0 && formData.client_ids.length < allClients.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({ ...prev, client_ids: allClients.map(c => c.id) }));
                            } else {
                              setFormData(prev => ({ ...prev, client_ids: [] }));
                            }
                          }}
                        />
                      }
                      label={<Typography variant="body2" color="text.secondary">Select All</Typography>}
                    />
                  )}
                </Box>
                <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto', p: 1 }}>
                  {(Array.isArray(allClients) ? allClients : []).map(client => (
                    <Box key={client.id}>
                      <FormControlLabel
                        control={<Checkbox checked={formData.client_ids.includes(client.id)} onChange={() => toggleClient(client.id)} />}
                        label={<Typography variant="body2">{client.name} {client.access_type === 'public' ? '(Public)' : ''}</Typography>}
                      />
                    </Box>
                  ))}
                  {(!Array.isArray(allClients) || allClients.length === 0) && <Typography variant="body2" p={2}>No applications available.</Typography>}
                </Paper>
              </Grid>
            </Grid>

          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, px: 3 }}>
          <Button onClick={() => setOpenForm(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!formData.name}>Save Group</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
