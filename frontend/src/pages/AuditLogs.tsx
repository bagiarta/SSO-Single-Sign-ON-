import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Chip, MenuItem, FormControl, InputLabel, Select, Grid, Tooltip, Stack, Avatar
} from '@mui/material';
import { 
  CheckCircle as CheckCircleIcon, 
  Computer as ComputerIcon,
  Apple as AppleIcon, Window as WindowsIcon, Android as AndroidIcon,
  Shield as ShieldIcon, SecurityUpdateWarning as WarningIcon
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../store/store';
import { fetchAuditLogs } from '../store/providerSlice';
import { formatServerDate } from '../utils/date';

const getDeviceIcons = (userAgent?: string) => {
  if (!userAgent) return { os: <ComputerIcon fontSize="small" />, browserStr: 'Unknown Browser' };
  
  const ua = userAgent.toLowerCase();
  let osIcon = <ComputerIcon fontSize="small" />;
  if (ua.includes('windows')) osIcon = <WindowsIcon fontSize="small" />;
  if (ua.includes('mac') || ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) osIcon = <AppleIcon fontSize="small" />;
  if (ua.includes('android')) osIcon = <AndroidIcon fontSize="small" />;
  if (ua.includes('linux')) osIcon = <ComputerIcon fontSize="small" />;

  let browserStr = 'Unknown Browser';
  if (ua.includes('chrome')) browserStr = 'Chrome';
  else if (ua.includes('firefox')) browserStr = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browserStr = 'Safari';
  else if (ua.includes('edge')) browserStr = 'Edge';
  else if (ua.includes('postman')) browserStr = 'Postman Runtime';

  return { os: osIcon, browserStr };
};

export const AuditLogs: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { auditLogs, auditTotal, loading } = useSelector((state: RootState) => state.providers);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [eventType, setEventType] = useState('');

  useEffect(() => {
    dispatch(fetchAuditLogs({ limit: rowsPerPage, offset: page * rowsPerPage, eventType }));
  }, [dispatch, page, rowsPerPage, eventType]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  const handleFilterChange = (value: string) => {
    setEventType(value);
    setPage(0);
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}><ShieldIcon /></Avatar>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Security & Audit Logs</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Trace all system activities including logins, configuration changes, and session management.
          </Typography>
        </Box>
      </Box>

      {/* Filter Row */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Event Type</InputLabel>
              <Select value={eventType} label="Event Type" onChange={(e) => handleFilterChange(e.target.value)}>
                <MenuItem value="">All Events</MenuItem>
                <MenuItem value="USER_LOGIN">User Login</MenuItem>
                <MenuItem value="SESSION_REVOKE">Session Revoked</MenuItem>
                <MenuItem value="SESSION_REVOKE_ALL">All Sessions Revoked</MenuItem>
                <MenuItem value="USER_CREATE">User Created</MenuItem>
                <MenuItem value="USER_DELETE">User Deleted</MenuItem>
                <MenuItem value="PROVIDER_CREATE">Provider Created</MenuItem>
                <MenuItem value="PROVIDER_DELETE">Provider Deleted</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Audit Log Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Event</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Result</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>IP & Device</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {auditLogs.length === 0 && !loading ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>No audit logs found.</TableCell></TableRow>
            ) : (
              auditLogs.map((log) => {
                const isSuccess = log.result === 'success';
                const isDelete = log.action === 'delete' || log.action === 'revoke';
                
                // Determine row background color
                let rowBg = 'inherit';
                if (!isSuccess) rowBg = 'error.lighter';
                else if (isDelete) rowBg = 'warning.lighter';

                let detailsText = '';
                try {
                  const detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                  detailsText = detailsObj.message || JSON.stringify(detailsObj);
                } catch {
                  detailsText = String(log.details);
                }

                const device = getDeviceIcons(log.user_agent);

                return (
                  <TableRow key={log.id} hover sx={{ bgcolor: rowBg, '&:hover': { bgcolor: rowBg === 'inherit' ? 'action.hover' : rowBg } }}>
                    <TableCell sx={{ whiteSpace: 'nowrap', py: 1.5 }}>
                      <Typography variant="body2" fontWeight={500}>{formatServerDate(log.timestamp).split(',')[0]}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatServerDate(log.timestamp).split(',')[1]}</Typography>
                    </TableCell>
                    <TableCell>
                      {log.username ? (
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{log.username}</Typography>
                          <Typography variant="caption" color="text.secondary">{log.email}</Typography>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>System Event</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Chip
                          label={log.event_type.replace(/_/g, ' ')}
                          size="small"
                          color={
                            log.event_type.includes('LOGIN') ? 'primary' :
                            log.event_type.includes('REVOKE') ? 'error' :
                            log.event_type.includes('CREATE') ? 'success' :
                            log.event_type.includes('DELETE') ? 'warning' : 'default'
                          }
                          sx={{ fontWeight: 600, fontSize: '0.7rem', height: 20 }}
                        />
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>{log.action}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: isSuccess ? 'success.main' : 'error.main' }}>
                        {isSuccess ? <CheckCircleIcon fontSize="small" /> : <WarningIcon fontSize="small" />}
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {log.result.toUpperCase()}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{device.os}</Box>
                        <Box>
                          <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">{log.ip_address || '—'}</Typography>
                          <Tooltip title={log.user_agent || 'Unknown UA'} arrow>
                            <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                              {device.browserStr}
                            </Typography>
                          </Tooltip>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Tooltip title={detailsText} arrow placement="left">
                        <Typography variant="body2" sx={{ cursor: 'help', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {detailsText}
                        </Typography>
                      </Tooltip>
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
          count={auditTotal}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    </Box>
  );
};
export default AuditLogs;
