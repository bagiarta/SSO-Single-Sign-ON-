import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Public as PublicIcon,
  Dns as DnsIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../store/store';
import { formatServerDate } from '../utils/date';
import { fetchProviders, toggleProviderStatus, deleteProvider, Provider } from '../store/providerSlice';

export const ProviderList: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { providers, loading } = useSelector((state: RootState) => state.providers);

  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchProviders());
  }, [dispatch]);

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'enabled' ? 'disabled' : 'enabled';
    dispatch(toggleProviderStatus({ id, status: nextStatus }));
  };

  const handleDeleteConfirm = () => {
    if (deleteId) {
      dispatch(deleteProvider(deleteId));
      setDeleteId(null);
    }
  };

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'saml':
        return <SecurityIcon color="primary" />;
      case 'oauth':
        return <PublicIcon color="secondary" />;
      case 'ldap':
        return <DnsIcon color="success" />;
      default:
        return <SecurityIcon />;
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'enabled':
        return <Chip label="ENABLED" color="success" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
      case 'disabled':
        return <Chip label="DISABLED" color="default" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
      case 'error':
        return <Chip label="ERROR" color="error" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
      default:
        return <Chip label={status.toUpperCase()} size="small" />;
    }
  };

  if (loading && providers.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Identity Providers
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Configure and manage SAML 2.0, OAuth 2.0 / OIDC, and LDAP enterprise directories.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/providers/new')}
          sx={{ borderRadius: 2 }}
        >
          Add Provider
        </Button>
      </Box>

      {providers.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>No providers configured</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Add your first SAML, OAuth, or LDAP provider configuration to enable single sign-on.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/providers/new')}>
            Add Provider
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Last Validated</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Active</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {providers.map((provider: Provider) => (
                <TableRow key={provider.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{provider.name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getProviderIcon(provider.type)}
                      <Typography variant="body2" sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.8rem' }}>
                        {provider.type}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{getStatusChip(provider.status)}</TableCell>
                  <TableCell>
                    {provider.last_validated_at
                      ? formatServerDate(provider.last_validated_at)
                      : 'Never'}
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={provider.status === 'enabled'}
                      onChange={() => handleToggleStatus(provider.id!, provider.status)}
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit configuration">
                      <IconButton onClick={() => navigate(`/providers/edit/${provider.id}`)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete configuration">
                      <IconButton color="error" onClick={() => setDeleteId(provider.id!)}>
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
      <Dialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          Confirm Deletion
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this Identity Provider configuration? This action cannot be undone and will disrupt user logins configured with this provider.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
export default ProviderList;
