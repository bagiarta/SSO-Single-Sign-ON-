import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, Tooltip, Switch, Snackbar, Alert, Stack
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Autorenew as AutorenewIcon } from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_BASE_URL || '/sso-api';

const readConfiguration = (value: unknown) => {
  if (!value) return {};
  try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return {}; }
};

export const ClientList: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [secretDialog, setSecretDialog] = useState<{open: boolean, secret: string, clientId: string}>({open: false, secret: '', clientId: ''});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/clients`);
      setClients(res.data);
    } catch (err: any) {
      setSnackbar({ open: true, message: 'Failed to fetch clients', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      await axios.put(`${API_URL}/clients/${id}`, { status: nextStatus });
      fetchClients();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to update status', severity: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteId) {
      try {
        await axios.delete(`${API_URL}/clients/${deleteId}`);
        setDeleteId(null);
        fetchClients();
        setSnackbar({ open: true, message: 'Client deleted successfully', severity: 'success' });
      } catch (err) {
        setSnackbar({ open: true, message: 'Failed to delete client', severity: 'error' });
      }
    }
  };

  const handleRegenerateSecret = async (id: string) => {
    if (!window.confirm("Are you sure? All existing client applications using the old secret will immediately lose access.")) return;
    try {
      const res = await axios.post(`${API_URL}/clients/${id}/regenerate-secret`);
      setSecretDialog({
        open: true,
        clientId: res.data.client_id,
        secret: res.data.client_secret
      });
      fetchClients();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to regenerate secret', severity: 'error' });
    }
  };

  if (loading && clients.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', height: '60vh', alignItems: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Client Applications</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage Service Providers (OAuth2/OIDC Clients) that authenticate via this SSO Server.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/clients/new')} sx={{ borderRadius: 2 }}>
          Register Client
        </Button>
      </Box>

      {clients.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>No Client Applications registered</Typography>
          <Button variant="contained" onClick={() => navigate('/clients/new')} sx={{ mt: 2 }}>Register Application</Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>App Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Client ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Redirect URIs</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Protocol</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clients.map(client => (
                <TableRow key={client.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{client.name}</TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{client.client_id}</Typography></TableCell>
                  <TableCell>
                    {(() => {
                      try {
                        const uris = JSON.parse(client.redirect_uris);
                        return <Chip label={`${uris.length} URIs`} size="small" />;
                      } catch {
                        return <Chip label="1 URI" size="small" />;
                      }
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const config = readConfiguration(client.configuration);
                      return <Stack direction="column" spacing={0.5} alignItems="flex-start">
                        <Chip label={(config.protocol || 'oidc').toUpperCase()} size="small" color="primary" variant="outlined" />
                        {config.pkceRequired !== false && <Typography variant="caption" color="text.secondary">PKCE enabled</Typography>}
                      </Stack>;
                    })()}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip label={client.status.toUpperCase()} color={client.status === 'active' ? 'success' : 'default'} size="small" variant="outlined" />
                      <Switch checked={client.status === 'active'} onChange={() => handleToggleStatus(client.id, client.status)} color="primary" size="small" inputProps={{ 'aria-label': `Toggle ${client.name} status` }} />
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Regenerate Client Secret">
                      <IconButton color="warning" onClick={() => handleRegenerateSecret(client.id)}>
                        <AutorenewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit App">
                      <IconButton onClick={() => navigate(`/clients/edit/${client.id}`)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete App">
                      <IconButton color="error" onClick={() => setDeleteId(client.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this Client Application? Authentications utilizing this Client ID will immediately fail.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Secret Dialog */}
      <Dialog open={secretDialog.open} onClose={() => setSecretDialog({...secretDialog, open: false})}>
        <DialogTitle sx={{ color: 'error.main' }}>New Client Secret Generated</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Please copy this secret immediately. For security reasons, it will never be displayed again.
          </DialogContentText>
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="caption" display="block">Client ID:</Typography>
            <Typography sx={{ fontFamily: 'monospace', mb: 2 }}>{secretDialog.clientId}</Typography>
            <Typography variant="caption" display="block">Client Secret:</Typography>
            <Typography sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{secretDialog.secret}</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSecretDialog({...secretDialog, open: false})} variant="contained">I have copied the secret</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({...snackbar, open: false})}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};
export default ClientList;
