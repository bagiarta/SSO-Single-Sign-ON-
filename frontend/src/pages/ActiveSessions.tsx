import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Button,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Laptop as LaptopIcon,
  PhoneAndroid as PhoneIcon,
  DesktopWindows as DesktopIcon,
  Refresh as RefreshIcon,
  DeleteSweep as DeleteSweepIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { formatServerDate, parseServerDate } from '../utils/date';

const API_URL = process.env['REACT_APP_API_BASE_URL'] || '/sso-api';

interface Session {
  id: string;
  user_id: string;
  ip_address: string;
  user_agent: string;
  device_info: string;
  created_at: string;
  expires_at: string;
  last_active_at: string;
  is_revoked: boolean;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  client_name?: string;
}

const ActiveSessions: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; type: 'single' | 'all'; sessionId?: string; userId?: string; username?: string }>({
    open: false, type: 'single'
  });

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('sso_token');
      const { data } = await axios.get(`${API_URL}/sessions`, {
        params: { limit: rowsPerPage, offset: page * rowsPerPage, status: statusFilter },
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter]);

  useEffect(() => {
    fetchSessions();
    const refreshTimer = window.setInterval(fetchSessions, 30000);
    return () => window.clearInterval(refreshTimer);
  }, [fetchSessions]);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('sso_token');
      await axios.delete(`${API_URL}/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSessions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke session');
    }
    setConfirmDialog({ open: false, type: 'single' });
  };

  const handleRevokeAllUserSessions = async (userId: string) => {
    try {
      const token = localStorage.getItem('sso_token');
      await axios.delete(`${API_URL}/sessions/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSessions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke sessions');
    }
    setConfirmDialog({ open: false, type: 'all' });
  };

  const getSessionStatus = (session: Session): { label: string; color: 'success' | 'error' | 'warning' } => {
    if (session.is_revoked) return { label: 'REVOKED', color: 'error' };
    if (new Date(session.expires_at) < new Date()) return { label: 'EXPIRED', color: 'warning' };
    return { label: 'ACTIVE', color: 'success' };
  };

  const getDeviceIcon = (deviceInfo: string) => {
    if (!deviceInfo) return <DesktopIcon fontSize="small" />;
    const lower = deviceInfo.toLowerCase();
    if (lower.includes('android') || lower.includes('ios')) return <PhoneIcon fontSize="small" />;
    return <LaptopIcon fontSize="small" />;
  };

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const then = parseServerDate(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Active Sessions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Monitor active user sessions, view device and IP information, and force-close sessions if needed.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Filter Row */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              >
                <MenuItem value="">All Sessions</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="revoked">Revoked</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchSessions}
              disabled={loading}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Sessions Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Client App</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>IP Address</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Device</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Login Time</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Last Active</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>Loading...</TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>No sessions found.</TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => {
                const status = getSessionStatus(session);
                return (
                  <TableRow key={session.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {session.username || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {session.email}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} color={session.client_name ? "primary" : "text.secondary"}>
                        {session.client_name || 'SSO Portal (Direct)'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {session.ip_address || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getDeviceIcon(session.device_info)}
                        <Box>
                          <Typography variant="body2">
                            {session.device_info || 'Unknown Device'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatServerDate(session.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatTimeAgo(session.last_active_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={status.label} color={status.color} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        {status.label === 'ACTIVE' && (
                          <>
                            <Tooltip title="Force close this session">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setConfirmDialog({ open: true, type: 'single', sessionId: session.id, username: session.username })}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={`Close all sessions for ${session.username}`}>
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() => setConfirmDialog({ open: true, type: 'all', userId: session.user_id, username: session.username })}
                              >
                                <DeleteSweepIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[15, 30, 50]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />
      </TableContainer>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, type: 'single' })}>
        <DialogTitle>
          {confirmDialog.type === 'single' ? 'Revoke Session' : 'Revoke All Sessions'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmDialog.type === 'single'
              ? `Are you sure you want to force-close this session for user "${confirmDialog.username}"? The user will be logged out immediately.`
              : `Are you sure you want to force-close ALL active sessions for user "${confirmDialog.username}"? The user will be logged out from all devices.`
            }
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, type: 'single' })}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (confirmDialog.type === 'single' && confirmDialog.sessionId) {
                handleRevokeSession(confirmDialog.sessionId);
              } else if (confirmDialog.type === 'all' && confirmDialog.userId) {
                handleRevokeAllUserSessions(confirmDialog.userId);
              }
            }}
          >
            {confirmDialog.type === 'single' ? 'Revoke Session' : 'Revoke All'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ActiveSessions;
